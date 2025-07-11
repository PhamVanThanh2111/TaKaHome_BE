import { IsNotEmpty } from 'class-validator';

export class CreateFavoriteDto {
  @IsNotEmpty()
  userId: number;

  @IsNotEmpty()
  propertyId: number;
}
