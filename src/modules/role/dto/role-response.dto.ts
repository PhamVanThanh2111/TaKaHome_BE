import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '../../common/enums/role.enum';

export class RoleResponseDto {
  @ApiProperty({
    example: 'ba77ff71-73b8-41c1-930c-73ecab3ad201',
    description: 'UUID role',
  })
  id: string;

  @ApiProperty({ example: RoleEnum.ADMIN, enum: RoleEnum })
  name: RoleEnum;
}
