import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email đăng ký tài khoản',
  })
  email: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: '0123456789',
    required: false,
    description: 'Số điện thoại',
  })
  phone?: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({
    example: 'password123',
    minLength: 6,
    description: 'Mật khẩu',
  })
  password: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Nguyễn Văn A',
    required: false,
    description: 'Tên đầy đủ của user',
  })
  fullName?: string;
}
