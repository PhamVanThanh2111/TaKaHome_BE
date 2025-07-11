import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyUtilityDto } from './create-property-utility.dto';

export class UpdatePropertyUtilityDto extends PartialType(
  CreatePropertyUtilityDto,
) {}
