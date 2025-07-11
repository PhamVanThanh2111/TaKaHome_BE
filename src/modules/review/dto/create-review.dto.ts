import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  reviewerId: number;

  @IsNotEmpty()
  propertyId: number;

  @IsString()
  comment: string;

  @IsNumber()
  rating: number;
}
