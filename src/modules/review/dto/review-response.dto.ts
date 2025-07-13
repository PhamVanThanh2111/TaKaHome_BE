import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: '72e75314-54c5-441f-9dbd-4fd3469ea9e0' })
  id: string;

  @ApiProperty({ example: 'd5b3a3c9-1762-4bd8-b160-26061c747fa3' })
  reviewerId: string;

  @ApiProperty({ example: '98fdd9a4-5d91-4d8f-bf4d-71c68fa88961' })
  propertyId: string;

  @ApiProperty({ example: 'Dịch vụ tốt, chủ nhà thân thiện' })
  comment: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({
    example: '2024-07-15T10:20:30.000Z',
    description: 'Ngày tạo',
    required: false,
  })
  createdAt?: string;
}
