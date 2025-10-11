import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Phòng đơn có WC riêng',
    description: 'Tên loại phòng',
  })
  name?: string;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 1,
    description: 'Số phòng ngủ',
  })
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 1,
    description: 'Số phòng tắm',
  })
  bathrooms?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 25,
    description: 'Diện tích (m2)',
  })
  area?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 3500000,
    description: 'Giá thuê (VND)',
  })
  price?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 3500000,
    description: 'Tiền đặt cọc (VND)',
  })
  deposit?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 4,
    description: 'Số lượng phòng loại này',
  })
  count?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({
    example: ['0-A101', '0-A102', '1-A201', '1-A202'],
    description: 'Vị trí các phòng (floorIndex-roomNumber)',
  })
  locations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    example: [
      'https://example.com/images/room-type1-1.jpg',
      'https://example.com/images/room-type1-2.jpg',
    ],
    description: 'Danh sách hình ảnh',
    required: false,
  })
  images?: string[];
}
