import { IsEnum, IsNotEmpty } from 'class-validator';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class UploadPropertyImagesDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(PropertyTypeEnum)
  entityType: PropertyTypeEnum;
}
