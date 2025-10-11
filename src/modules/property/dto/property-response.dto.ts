import { ApiProperty } from '@nestjs/swagger';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';
import { FloorResponseDto } from './floor-response.dto';
import { RoomTypeResponseDto } from './room-type-response.dto';

export class PropertyResponseDto {
  @ApiProperty({ example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd' })
  id: string;

  @ApiProperty({ example: 'Căn hộ Masteri' })
  title: string;

  @ApiProperty({ example: 'Căn hộ 2PN view sông, đầy đủ tiện nghi' })
  description: string;

  @ApiProperty({ example: PropertyTypeEnum.APARTMENT, enum: PropertyTypeEnum })
  type: PropertyTypeEnum;

  @ApiProperty({ example: 'Thành phố Hồ Chí Minh' })
  province: string;

  @ApiProperty({ example: 'Gò Vấp' })
  ward: string;

  @ApiProperty({ example: '123 Lê Lợi' })
  address: string;

  @ApiProperty({ example: 'Block A', required: false })
  block?: string;

  @ApiProperty({ example: 'Đầy đủ' })
  furnishing: string;

  @ApiProperty({ example: 'Sổ hồng', required: false })
  legalDoc?: string;

  @ApiProperty({ example: 12000000 })
  price: number;

  @ApiProperty({ example: 3500, required: false })
  electricityPricePerKwh?: number;

  @ApiProperty({ example: 25000, required: false })
  waterPricePerM3?: number;

  @ApiProperty({ example: 3000000 })
  deposit: number;

  @ApiProperty({ example: 80 })
  area: number;

  @ApiProperty({ example: 2 })
  bedrooms: number;

  @ApiProperty({ example: 2 })
  bathrooms: number;

  @ApiProperty({ example: '10.7769,106.7009', required: false })
  mapLocation?: string;

  @ApiProperty({ example: true })
  isVisible: boolean;

  @ApiProperty({ example: StatusEnum.ACTIVE, enum: StatusEnum })
  status: StatusEnum;

  @ApiProperty({
    example: 'https://example.com/hero-image.jpg',
    required: false,
  })
  heroImage?: string;

  @ApiProperty({ example: '6a36daba-79e1-4de8-8db5-281d8f6a81c1' })
  landlordId: string;

  @ApiProperty({
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    required: false,
  })
  images?: string[];

  @ApiProperty({ example: 'A1-101', required: false })
  unit?: string;

  // BOARDING-specific fields
  @ApiProperty({ type: [FloorResponseDto], required: false })
  floors?: FloorResponseDto[];

  @ApiProperty({ type: [RoomTypeResponseDto], required: false })
  roomTypes?: RoomTypeResponseDto[];

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  updatedAt: Date;
}
