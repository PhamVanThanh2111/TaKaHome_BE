import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id?: string;

  @ApiPropertyOptional({
    example: 'refresh-token-abc',
    description: 'Refresh Token mới',
  })
  refreshToken?: string;

  @ApiPropertyOptional({
    example: '2024-07-20T09:12:23.000Z',
    description: 'Thời gian đăng nhập cuối cùng',
  })
  lastLoginAt?: Date;

  @ApiPropertyOptional({
    example: ['TENANT', 'LANDLORD'],
    description: 'Danh sách vai trò của tài khoản',
    type: [String],
  })
  roles?: RoleEnum[];
}
