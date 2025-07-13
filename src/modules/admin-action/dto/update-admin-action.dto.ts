import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminActionDto } from './create-admin-action.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminActionDto extends PartialType(CreateAdminActionDto) {
  @ApiPropertyOptional({
    example: 'b0c727b1-0c35-40f3-87da-d4eabdc4b023',
    description: 'ID admin action',
  })
  id?: string;
}
