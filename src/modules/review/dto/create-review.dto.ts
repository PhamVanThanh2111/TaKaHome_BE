import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  reviewerId: string;

  @IsNotEmpty()
  propertyId: string;

  @IsString()
  comment: string;

  @IsNumber()
  rating: number;
}
