/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Account } from '../../account/entities/account.entity';
import { User } from '../../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from '../../common/enums/role.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { BlockchainService } from 'src/modules/blockchain/blockchain.service';
import { Logger } from '@nestjs/common';
import { vnNow } from 'src/common/datetime';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { EmailService } from 'src/modules/email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      const firebaseConfig = {
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        privateKey: this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      };

      // Check if Firebase credentials are configured
      if (
        firebaseConfig.projectId &&
        firebaseConfig.privateKey &&
        firebaseConfig.clientEmail
      ) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            privateKey: firebaseConfig.privateKey,
            clientEmail: firebaseConfig.clientEmail,
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.logger.warn(
          'Firebase credentials not found in environment variables',
        );
      }
    }
  }

  async register(
    dto: RegisterDto,
  ): Promise<ResponseCommon<{ message: string }>> {
    // Check email đã tồn tại
    const exist = await this.accountRepo.findOne({
      where: { email: dto.email },
    });
    if (exist) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(dto.password, 10);

    // Khởi tạo user
    const user = this.userRepo.create({
      email: dto.email,
      phone: dto.phone,
      fullName: dto.fullName,
    });
    await this.userRepo.save(user);

    // role mặc định cho account mới (TENANT)
    const defaultRoles = dto.roles ? dto.roles : RoleEnum.TENANT;

    const account = this.accountRepo.create({
      email: dto.email,
      password: hash,
      isVerified: false,
      roles: dto.roles ? [dto.roles] : [defaultRoles],
      user: user,
    });
    await this.accountRepo.save(account);

    // Enroll blockchain identity based on user role
    const orgName = this.determineOrgFromRole(defaultRoles);
    if (orgName) {
      try {
        await this.blockchainService.enrollUser({
          userId: user.id,
          orgName: orgName,
          role: defaultRoles,
        });
      } catch (error) {
        // Continue without failing registration - blockchain enrollment is optional
        this.logger.warn(
          `Blockchain enrollment failed for user ${user.id}: ${error.message}`,
        );
      }
    }

    return new ResponseCommon(200, 'SUCCESS', {
      message: 'Register successful!',
    });
  }

  /**
   * Determine organization name from user roles
   */
  private determineOrgFromRole(role: RoleEnum): string | null {
    if (role === RoleEnum.LANDLORD) return 'OrgLandlord';
    if (role === RoleEnum.TENANT) return 'OrgTenant';
    if (role === RoleEnum.ADMIN) return 'OrgProp';
    return null;
  }

  async validateAccount(
    email: string,
    password: string,
  ): Promise<ResponseCommon<Account | null>> {
    const acc = await this.accountRepo.findOne({
      where: { email },
      relations: ['user'],
    });
    if (!acc) return new ResponseCommon(200, 'SUCCESS', null);
    const match = await bcrypt.compare(password, acc.password);
    if (!match) return new ResponseCommon(200, 'SUCCESS', null);
    return new ResponseCommon(200, 'SUCCESS', acc);
  }

  async login(
    dto: LoginDto,
  ): Promise<
    ResponseCommon<{ accessToken: string; refreshToken: string; account: any }>
  > {
    const acc = await this.accountRepo.findOne({
      where: { email: dto.email },
      relations: ['user'],
    });
    if (!acc) throw new NotFoundException('Account not found');
    if (!(await bcrypt.compare(dto.password, acc.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      sub: acc.user.id,
      email: acc.email,
      roles: acc.roles,
      fullName: acc.user.fullName,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1d' });

    // Generate refresh token (7 days)
    const refreshToken = this.jwtService.sign(
      { sub: acc.user.id, email: acc.email, type: 'refresh' },
      { expiresIn: '7d' },
    );

    // Save refresh token to database
    acc.refreshToken = refreshToken;
    acc.lastLoginAt = vnNow();
    await this.accountRepo.save(acc);

    return new ResponseCommon(200, 'SUCCESS', {
      accessToken,
      refreshToken,
      account: {
        id: acc.id,
        email: acc.email,
        roles: acc.roles,
        isVerified: acc.isVerified,
        user: {
          id: acc.user.id,
          fullName: acc.user.fullName,
          avatarUrl: acc.user.avatarUrl,
          status: acc.user.status,
          CCCD: acc.user.CCCD,
          phone: acc.user.phone,
        },
        createdAt: acc.user.createdAt,
        updatedAt: acc.user.updatedAt,
      },
    });
  }

  async handleGoogleLogin(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    account: any;
    accountStatus: 'new' | 'existing';
  }> {
    try {
      // Đổi code lấy token
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.configService.get<string>('GOOGLE_REDIRECT_URI'),
          grant_type: 'authorization_code',
        },
      );

      const { access_token } = tokenResponse.data as { access_token: string };

      // Lấy thông tin người dùng từ Google
      const userInfoResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      );

      const { email, name, picture } = userInfoResponse.data as {
        email: string;
        name: string;
        picture?: string;
      };

      // Xử lý trong hệ thống
      const result = await this.findOrCreateGoogleUser(email, name, picture);

      // Sinh JWT
      const payload = {
        sub: result.user.id,
        email: result.account.email,
        roles: result.account.roles,
        fullName: result.user.fullName,
      };

      // Generate access token
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1d' });

      // Generate refresh token (7 days)
      const refreshToken = this.jwtService.sign(
        { sub: result.user.id, email: result.account.email, type: 'refresh' },
        { expiresIn: '7d' },
      );

      // Save refresh token and update last login
      result.account.refreshToken = refreshToken;
      result.account.lastLoginAt = vnNow();
      await this.accountRepo.save(result.account);

      return {
        accessToken,
        refreshToken,
        account: {
          id: result.account.id,
          email: result.account.email,
          roles: result.account.roles,
          isVerified: result.account.isVerified,
          user: {
            id: result.user.id,
            fullName: result.user.fullName,
            avatarUrl: result.user.avatarUrl,
            status: result.user.status,
            CCCD: result.user.CCCD,
            phone: result.user.phone,
          },
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
        accountStatus: result.isNew ? 'new' : 'existing',
      };
    } catch (error) {
      this.logger.error('Google OAuth error:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  private async findOrCreateGoogleUser(
    email: string,
    name: string,
    picture?: string,
  ): Promise<{ account: Account; user: User; isNew: boolean }> {
    // Kiểm tra user đã tồn tại chưa
    let account = await this.accountRepo.findOne({
      where: { email },
      relations: ['user'],
    });

    if (account) {
      // User đã tồn tại
      return { account, user: account.user, isNew: false };
    }

    // Tạo user mới
    const user = this.userRepo.create({
      email,
      fullName: name,
      avatarUrl: picture,
    });
    await this.userRepo.save(user);

    // Tạo account mới với role mặc định TENANT
    const defaultRole = RoleEnum.TENANT;
    // Tạo password random cho Google OAuth user (họ sẽ không dùng password này)
    const randomPassword = await bcrypt.hash(`google_oauth_${Date.now()}`, 10);

    account = this.accountRepo.create({
      email,
      password: randomPassword,
      isVerified: true, // Email đã được Google verify
      roles: [defaultRole],
      user: user,
    });
    await this.accountRepo.save(account);

    // Enroll blockchain identity
    const orgName = this.determineOrgFromRole(defaultRole);
    if (orgName) {
      try {
        await this.blockchainService.enrollUser({
          userId: user.id,
          orgName: orgName,
          role: defaultRole,
        });
      } catch (error) {
        this.logger.warn(
          `Blockchain enrollment failed for Google user ${user.id}: ${error.message}`,
        );
      }
    }

    return { account, user, isNew: true };
  }

  /**
   * Reset password using Firebase ID Token (SMS OTP)
   */
  async resetPassword(
    idToken: string,
    newPassword: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Step 1: Verify Firebase ID Token (signature, expiry, issuer)
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);

      // Step 2: Validate phone number exists in token
      let phoneNumber = decodedToken.phone_number;
      if (!phoneNumber) {
        throw new UnauthorizedException(
          'Invalid token: phone number not found',
        );
      }

      // Step 3: Validate token was issued recently (prevent replay attacks)
      const tokenIssuedAt = decodedToken.auth_time || decodedToken.iat;
      const tokenAge = Date.now() / 1000 - tokenIssuedAt;
      const maxTokenAge = 300; // 5 minutes
      if (tokenAge > maxTokenAge) {
        throw new UnauthorizedException(
          'Token đã quá hạn sử dụng. Vui lòng xác thực lại OTP.',
        );
      }

      // Step 4: Convert phone format from international to local
      // +84123456789 -> 0123456789
      if (phoneNumber.startsWith('+84')) {
        phoneNumber = '0' + phoneNumber.substring(3);
      } else if (phoneNumber.startsWith('+')) {
        // Validate only Vietnamese phone numbers
        throw new UnauthorizedException(
          'Chỉ hỗ trợ số điện thoại Việt Nam (+84)',
        );
      }

      // Step 5: Validate phone number format (Vietnamese)
      const vietnamesePhoneRegex = /^0[1-9]\d{8}$/;
      if (!vietnamesePhoneRegex.test(phoneNumber)) {
        throw new UnauthorizedException('Số điện thoại không hợp lệ');
      }

      this.logger.log(`Attempting password reset for phone: ${phoneNumber}`);

      // Step 6: Find user by phone number
      const user = await this.userRepo.findOne({
        where: { phone: phoneNumber },
        relations: ['account'],
      });

      if (!user) {
        throw new NotFoundException(
          'Không tìm thấy tài khoản với số điện thoại này',
        );
      }

      if (!user.account) {
        throw new NotFoundException(
          'Tài khoản chưa được kích hoạt hoặc không tồn tại',
        );
      }

      // Step 7: Validate Firebase UID matches (if user has Firebase UID stored)
      // This is extra security if you store Firebase UID in user table
      // if (user.firebaseUid && user.firebaseUid !== decodedToken.uid) {
      //   throw new UnauthorizedException('Token không khớp với tài khoản');
      // }

      // Step 8: Hash new password with bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Step 9: Update password in database
      user.account.password = hashedPassword;
      await this.accountRepo.save(user.account);

      this.logger.log(
        `Password reset successful via Firebase OTP for user: ${user.id}`,
      );

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đặt lại mật khẩu thành công!',
      });
    } catch (error) {
      this.logger.error('Reset password error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException(
        'Token không hợp lệ hoặc đã hết hạn. Vui lòng xác thực OTP lại.',
      );
    }
  }

  /**
   * Send forgot password email with reset token
   */
  async sendForgotPasswordEmail(
    email: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Step 1: Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        // Return generic message for security
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 2: Normalize email (lowercase, trim)
      const normalizedEmail = email.toLowerCase().trim();

      // Step 3: Find account by email
      const account = await this.accountRepo.findOne({
        where: { email: normalizedEmail },
        relations: ['user'],
      });

      if (!account) {
        // Security: Don't reveal if email exists or not
        // Still return success to prevent user enumeration
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 4: Validate account has associated user
      if (!account.user) {
        this.logger.warn(
          `Account ${account.id} has no associated user. Skipping email.`,
        );
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 5: Check if there's already a recent token (rate limiting)
      // Prevent spam by checking if token was generated recently
      if (account.resetPasswordToken) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const existingToken = this.jwtService.decode(
            account.resetPasswordToken,
          );
          
          if (existingToken?.timestamp) {
            const tokenAge = Date.now() - (existingToken.timestamp as number);
            const minTokenAge = 60000; // 1 minute cooldown

            if (tokenAge < minTokenAge) {
              this.logger.warn(
                `Rate limit: Reset email already sent recently for ${normalizedEmail}`,
              );
              return new ResponseCommon(200, 'SUCCESS', {
                message:
                  'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
              });
            }
          }
        } catch {
          // Invalid or expired token, proceed with new one
        }
      }

      // Step 6: Generate reset token (JWT with 1 hour expiry)
      const resetToken = this.jwtService.sign(
        {
          email: account.email,
          type: 'reset-password',
          timestamp: Date.now(),
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '1h', // Token expires in 1 hour
        },
      );

      // Step 7: Save reset token to database (overwrites old token)
      account.resetPasswordToken = resetToken;
      await this.accountRepo.save(account);

      // Step 8: Send email with token
      await this.emailService.sendResetPasswordEmail(
        normalizedEmail,
        resetToken,
        account.user.fullName,
      );

      this.logger.log(`Reset password email sent to: ${normalizedEmail}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
      });
    } catch (error) {
      this.logger.error('Send forgot password email error:', error);
      // Return generic error, don't expose details
      return new ResponseCommon(200, 'SUCCESS', {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
      });
    }
  }

  /**
   * Reset password using token from email
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Step 1: Verify JWT signature and expiry
      const decoded = this.jwtService.verify<{
        email: string;
        type?: string;
        timestamp?: number;
        [key: string]: unknown;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Step 2: Validate token type
      if (decoded.type !== 'reset-password') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Step 3: Validate email exists in decoded token
      if (!decoded.email) {
        throw new UnauthorizedException('Invalid token: missing email');
      }

      // Step 4: Find account by email first
      const account = await this.accountRepo.findOne({
        where: { email: decoded.email },
      });

      if (!account) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc tài khoản không tồn tại',
        );
      }

      // Step 5: CRITICAL - Validate token matches the one in database
      if (!account.resetPasswordToken) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc đã được sử dụng',
        );
      }

      // Step 6: CRITICAL - Token in DB must exactly match the provided token
      if (account.resetPasswordToken !== token) {
        throw new UnauthorizedException(
          'Token không khớp. Token có thể đã được sử dụng hoặc bị thay thế.',
        );
      }

      // Step 7: Additional security - Verify token timestamp is within reasonable time
      const tokenAge = Date.now() - (decoded.timestamp || 0);
      const oneHourInMs = 3600000;
      if (tokenAge > oneHourInMs) {
        // Extra check beyond JWT expiry
        account.resetPasswordToken = undefined;
        await this.accountRepo.save(account);
        throw new UnauthorizedException('Token đã hết hạn');
      }

      // Step 8: Hash new password with bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Step 9: Update password and CLEAR token (single-use token)
      account.password = hashedPassword;
      account.resetPasswordToken = undefined;
      await this.accountRepo.save(account);

      this.logger.log(
        `Password reset successful via email for: ${account.email}`,
      );

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đặt lại mật khẩu thành công!',
      });
    } catch (error) {
      this.logger.error('Reset password with token error:', error);
      if (
        error instanceof UnauthorizedException ||
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu reset mật khẩu lại.',
        );
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<ResponseCommon<{ accessToken: string; refreshToken: string }>> {
    try {
      // Step 1: Verify JWT signature and expiry
      const decoded = this.jwtService.verify<{
        sub: string;
        email: string;
        type?: string;
        [key: string]: unknown;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Step 2: Validate token type
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Step 3: Validate email exists in decoded token
      if (!decoded.email || !decoded.sub) {
        throw new UnauthorizedException('Invalid token: missing credentials');
      }

      // Step 4: Find account by email
      const account = await this.accountRepo.findOne({
        where: { email: decoded.email },
        relations: ['user'],
      });

      if (!account) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc tài khoản không tồn tại',
        );
      }

      // Step 5: CRITICAL - Validate refresh token matches the one in database
      if (!account.refreshToken) {
        throw new UnauthorizedException(
          'Refresh token không tồn tại. Vui lòng đăng nhập lại.',
        );
      }

      // Step 6: CRITICAL - Token in DB must exactly match the provided token
      if (account.refreshToken !== refreshToken) {
        throw new UnauthorizedException(
          'Refresh token không khớp. Vui lòng đăng nhập lại.',
        );
      }

      // Step 7: Validate user ID matches
      if (account.user.id !== decoded.sub) {
        throw new UnauthorizedException('Token không khớp với tài khoản');
      }

      // Step 8: Generate new access token
      const payload = {
        sub: account.user.id,
        email: account.email,
        roles: account.roles,
        fullName: account.user.fullName,
      };

      const newAccessToken = this.jwtService.sign(payload, {
        expiresIn: '1d',
      });

      // Step 9: Optionally rotate refresh token (recommended for security)
      // Generate new refresh token
      const newRefreshToken = this.jwtService.sign(
        { sub: account.user.id, email: account.email, type: 'refresh' },
        { expiresIn: '7d' },
      );

      // Save new refresh token to database
      account.refreshToken = newRefreshToken;
      await this.accountRepo.save(account);

      this.logger.log(`Access token refreshed for user: ${account.email}`);

      return new ResponseCommon(200, 'SUCCESS', {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      this.logger.error('Refresh token error:', error);
      if (
        error instanceof UnauthorizedException ||
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException(
          'Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        );
      }
      throw error;
    }
  }

  /**
   * Logout - clear refresh token from database
   */
  async logout(userId: string): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Find account by user ID
      const account = await this.accountRepo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });

      if (!account) {
        throw new NotFoundException('Tài khoản không tồn tại');
      }

      // Clear refresh token
      account.refreshToken = undefined;
      await this.accountRepo.save(account);

      this.logger.log(`User logged out: ${account.email}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đăng xuất thành công!',
      });
    } catch (error) {
      this.logger.error('Logout error:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Đăng xuất thất bại');
    }
  }
}
