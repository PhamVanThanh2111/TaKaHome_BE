import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional({
    example: 'ba77ff71-73b8-41c1-930c-73ecab3ad201',
    description: 'UUID role',
  })
  id?: string;

  @ApiPropertyOptional({ example: RoleEnum.TENANT, enum: RoleEnum })
  name?: RoleEnum;
}
