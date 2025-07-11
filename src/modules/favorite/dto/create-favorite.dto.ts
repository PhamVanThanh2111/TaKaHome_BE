import { IsNotEmpty } from 'class-validator';

export class CreateFavoriteDto {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  propertyId: string;
}
