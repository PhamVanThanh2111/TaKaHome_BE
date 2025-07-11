import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePropertyUtilityDto {
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
