import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

export class LoginResponseDto {
  @ApiProperty({ description: 'Access token JWT' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token JWT' })
  refreshToken: string;

  @ApiProperty({ example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123' })
  userId: string;

  @ApiProperty({ example: 'user@email.com' })
  email: string;

  @ApiProperty({ example: ['TENANT'], isArray: true, enum: RoleEnum })
  roles: RoleEnum[];
}
