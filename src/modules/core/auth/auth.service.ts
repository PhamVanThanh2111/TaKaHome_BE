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
  ) {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      const firebaseConfig = {
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      };

      // Check if Firebase credentials are configured
      if (firebaseConfig.projectId && firebaseConfig.privateKey && firebaseConfig.clientEmail) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            privateKey: firebaseConfig.privateKey,
            clientEmail: firebaseConfig.clientEmail,
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.logger.warn('Firebase credentials not found in environment variables');
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
  ): Promise<ResponseCommon<{ accessToken: string; account: any }>> {
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

    acc.lastLoginAt = vnNow();
    await this.accountRepo.save(acc);

    return new ResponseCommon(200, 'SUCCESS', {
      accessToken: this.jwtService.sign(payload),
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

      // Cập nhật last login
      result.account.lastLoginAt = vnNow();
      await this.accountRepo.save(result.account);

      return {
        accessToken: this.jwtService.sign(payload),
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
   * Reset password using Firebase ID Token
   */
  async resetPassword(
    idToken: string,
    newPassword: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Verify Firebase ID Token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      let phoneNumber = decodedToken.phone_number;
      

      if (!phoneNumber) {
        throw new UnauthorizedException('Invalid token: phone number not found');
      }

      if (phoneNumber.startsWith('+84')) {
        phoneNumber = '0' + phoneNumber.substring(3);
      }

      // Find user by phone number
      const user = await this.userRepo.findOne({
        where: { phone: phoneNumber },
        relations: ['account'],
      });

      if (!user || !user.account) {
        throw new NotFoundException('Account not found with this phone number');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      user.account.password = hashedPassword;
      await this.accountRepo.save(user.account);

      this.logger.log(`Password reset successful for user: ${user.id}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Password reset successful!',
      });
    } catch (error) {
      this.logger.error('Reset password error:', error);
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
