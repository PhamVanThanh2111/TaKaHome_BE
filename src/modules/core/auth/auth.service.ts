import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../user/entities/user.entity';
import { Role } from '../..//role/entities/role.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, fullName } = dto;
    const exist = await this.userRepository.findOne({ where: { email } });
    if (exist) throw new UnauthorizedException('Email already registered');

    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      password: hash,
      fullName,
    });

    // Gán vai trò mặc định (tenant)
    const tenantRole = await this.roleRepository.findOne({
      where: { name: RoleEnum.TENANT },
    });
    if (tenantRole) user.roles = [tenantRole];

    await this.userRepository.save(user);

    return { message: 'Register successful!' };
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
    if (!user) return null;
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['roles'],
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
      },
    };
  }
}
