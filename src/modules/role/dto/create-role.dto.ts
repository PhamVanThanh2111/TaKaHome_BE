import { IsEnum } from 'class-validator';
import { RoleEnum } from '../../common/enums/role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @IsEnum(RoleEnum)
  @ApiProperty({
    example: RoleEnum.TENANT,
    enum: RoleEnum,
    description: 'Tên role (ADMIN, TENANT, LANDLORD)',
  })
  name: RoleEnum;
}
