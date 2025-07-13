import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyUtilityDto } from './create-property-utility.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePropertyUtilityDto extends PartialType(
  CreatePropertyUtilityDto,
) {
  @ApiPropertyOptional({
    example: 'be0fbdac-25b9-46d5-8812-4a6afc3b86c7',
    description: 'ID property utility',
  })
  id?: string;
}
