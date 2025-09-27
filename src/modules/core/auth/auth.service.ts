import { Injectable, UnauthorizedException, Inject, forwardRef, Logger ,ConflictException} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Account } from '../../account/entities/account.entity';
import { User } from '../../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from '../../common/enums/role.enum';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => BlockchainService))
    private readonly blockchainService: BlockchainService,
  ) {}

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

    // role mặc định cho account mới (TENANT), hoặc sử dụng role từ DTO
    const defaultRoles = [RoleEnum.TENANT];

    // check roles từ dto (nếu có)
    if (
      dto.roles &&
      dto.roles.length > 0 &&
      dto.roles.includes(RoleEnum.LANDLORD)
    ) {
      defaultRoles.push(RoleEnum.LANDLORD);
    }

    const account = this.accountRepo.create({
      email: dto.email,
      password: hash,
      isVerified: false,
      roles: defaultRoles,
      user: user,
    });
    await this.accountRepo.save(account);

    // Enroll blockchain identity based on user role
    const orgName = this.determineOrgFromRole(defaultRoles);
    if (orgName) {
      try {
        await this.blockchainService.enrollUser({
          userId: user.id.toString(),
          orgName: orgName,
          role: defaultRoles[0]
        });
      } catch (error) {
        // Continue without failing registration - blockchain enrollment is optional
        this.logger.warn(`Blockchain enrollment failed for user ${user.id}: ${error.message}`);
      }
    }

    return new ResponseCommon(200, 'SUCCESS', {
      message: 'Register successful!',
    });
  }

  /**
   * Determine organization name from user roles
   */
  private determineOrgFromRole(roles: RoleEnum[]): string | null {
    if (roles.includes(RoleEnum.LANDLORD)) return 'OrgLandlord';
    if (roles.includes(RoleEnum.TENANT)) return 'OrgTenant';
    if (roles.includes(RoleEnum.ADMIN)) return 'OrgProp';
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
    if (!acc || !(await bcrypt.compare(dto.password, acc.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      sub: acc.user.id,
      email: acc.email,
      roles: acc.roles, // RoleEnum[]
    };
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
        },
      },
    });
  }
}
