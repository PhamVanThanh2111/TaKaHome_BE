import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

export class AccountResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user@email.com' })
  email: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: '2024-07-20T09:12:23.000Z', required: false })
  lastLoginAt?: Date;

  // Thông tin user (profile)
  @ApiProperty({ example: 'Nguyễn Văn A', required: false })
  fullName?: string;

  @ApiProperty({ example: '0123456789', required: false })
  phone?: string;

  @ApiProperty()
  roles: RoleEnum[];
}
