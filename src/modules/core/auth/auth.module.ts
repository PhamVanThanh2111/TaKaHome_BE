import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../../user/entities/user.entity';
import { Account } from '../../account/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Account]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'rent_home_khoa_luan_secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
