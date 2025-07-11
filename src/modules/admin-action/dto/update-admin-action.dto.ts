import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminActionDto } from './create-admin-action.dto';

export class UpdateAdminActionDto extends PartialType(CreateAdminActionDto) {}
