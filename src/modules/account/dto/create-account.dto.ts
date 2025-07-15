import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

export class CreateAccountDto {
  @ApiProperty({ example: 'user@email.com', description: 'Email đăng ký' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'yourPassword', minLength: 6 })
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: true, required: false })
  isVerified?: boolean;

  @ApiProperty({
    example: 'Tên đầy đủ',
    required: false,
    description: 'Thông tin user profile',
  })
  fullName?: string;

  @ApiProperty({ example: 'Số điện thoại', required: false })
  phone?: string;

  @ApiProperty({ example: 'TENANT', required: false })
  role: RoleEnum;
}
