import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @ApiProperty({ example: 'user@email.com', description: 'Email đăng ký' })
  email: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({
    example: 'yourPassword',
    minLength: 6,
    description: 'Mật khẩu',
  })
  password: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Nguyễn Văn A',
    required: false,
    description: 'Tên đầy đủ',
  })
  fullName?: string;
}
