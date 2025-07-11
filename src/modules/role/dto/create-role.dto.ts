import { IsEnum } from 'class-validator';
import { RoleEnum } from '../../common/enums/role.enum';

export class CreateRoleDto {
  @IsEnum(RoleEnum)
  name: RoleEnum;
}
