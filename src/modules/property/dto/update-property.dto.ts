import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyDto } from './create-property.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyTypeEnum } from 'src/modules/common/enums/property-type.enum';
import { StatusEnum } from 'src/modules/common/enums/status.enum';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({
    example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd',
    description: 'ID Property',
  })
  id?: string;

  @ApiPropertyOptional({
    example: PropertyTypeEnum.HOUSING,
    enum: PropertyTypeEnum,
  })
  type?: PropertyTypeEnum;

  @ApiPropertyOptional({
    example: StatusEnum.ACTIVE,
    enum: StatusEnum,
    description: 'Trạng thái property',
  })
  status?: StatusEnum;
}
