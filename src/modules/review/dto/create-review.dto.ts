import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'd5b3a3c9-1762-4bd8-b160-26061c747fa3',
    description: 'ID người đánh giá (reviewer)',
  })
  reviewerId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '98fdd9a4-5d91-4d8f-bf4d-71c68fa88961',
    description: 'ID bất động sản',
  })
  propertyId: string;

  @IsString()
  @ApiProperty({
    example: 'Dịch vụ tốt, chủ nhà thân thiện',
    description: 'Nội dung đánh giá',
  })
  comment: string;

  @IsNumber()
  @ApiProperty({ example: 5, description: 'Số sao đánh giá (1-5)' })
  rating: number;
}
