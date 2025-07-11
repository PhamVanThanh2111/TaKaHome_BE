import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePropertyImageDto {
  @IsNotEmpty()
  propertyId: number;

  @IsString()
  imageUrl: string;
}
