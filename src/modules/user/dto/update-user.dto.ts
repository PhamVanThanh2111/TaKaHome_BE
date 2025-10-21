import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, IsEmail, IsEnum } from 'class-validator';
import { UserStatusEnum } from '../../common/enums/user-status.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Email người dùng',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Tên đầy đủ của người dùng',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @Length(1, 100, { message: 'Họ tên phải từ 1 đến 100 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại người dùng',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Length(1, 20, { message: 'Số điện thoại phải từ 1 đến 20 ký tự' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Số CCCD của người dùng',
  })
  @IsOptional()
  @IsString({ message: 'CCCD phải là chuỗi' })
  CCCD?: string;

  @ApiPropertyOptional({
    description: 'URL avatar của người dùng',
  })
  @IsOptional()
  @IsString({ message: 'Avatar URL phải là chuỗi' })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài khoản (chỉ admin mới có thể cập nhật)',
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatusEnum, { message: 'Trạng thái không hợp lệ' })
  status?: UserStatusEnum;
}
