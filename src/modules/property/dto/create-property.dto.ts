import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
} from 'class-validator';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  description: string;

  @IsString()
  address: string;

  @IsEnum(PropertyTypeEnum)
  type: PropertyTypeEnum;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsNumber()
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsString()
  mapLocation?: string;
}
