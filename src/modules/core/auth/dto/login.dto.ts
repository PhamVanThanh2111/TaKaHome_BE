import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @ApiProperty({ example: 'admin@gmail.com', description: 'Email đăng nhập' })
  email: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({
    example: 'yourPassword',
    minLength: 6,
    description: 'Mật khẩu',
  })
  password: string;
}
