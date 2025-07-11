import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePropertyImageDto {
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  imageUrl: string;
}
