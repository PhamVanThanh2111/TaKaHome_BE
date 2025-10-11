import { ApiProperty } from '@nestjs/swagger';

export class RoomTypeResponseDto {
  @ApiProperty({ example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd' })
  id: string;

  @ApiProperty({ example: 'Phòng đơn có WC riêng' })
  name: string;

  @ApiProperty({ example: 1 })
  bedrooms: number;

  @ApiProperty({ example: 1 })
  bathrooms: number;

  @ApiProperty({ example: 25 })
  area: number;

  @ApiProperty({ example: 3500000 })
  price: number;

  @ApiProperty({ example: 3500000 })
  deposit: number;

  @ApiProperty({ example: 6 })
  count: number;

  @ApiProperty({ example: ['0-A101', '0-A102', '1-A201', '1-A202'] })
  locations: string[];

  @ApiProperty({
    example: [
      'https://example.com/images/room-type1-1.jpg',
      'https://example.com/images/room-type1-2.jpg',
    ],
    required: false,
  })
  images?: string[];

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  updatedAt: Date;
}
