import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Phòng đơn có WC riêng',
    description: 'Tên loại phòng',
  })
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Phòng trọ với đầy đủ tiện nghi',
    description: 'Mô tả loại phòng',
    required: false,
  })
  description?: string;

  @IsNumber()
  @ApiProperty({
    example: 1,
    description: 'Số phòng ngủ',
  })
  bedrooms: number;

  @IsNumber()
  @ApiProperty({
    example: 1,
    description: 'Số phòng tắm',
  })
  bathrooms: number;

  @IsNumber()
  @ApiProperty({
    example: 25,
    description: 'Diện tích (m2)',
  })
  area: number;

  @IsNumber()
  @ApiProperty({
    example: 3500000,
    description: 'Giá thuê (VND)',
  })
  price: number;

  @IsNumber()
  @ApiProperty({
    example: 3500000,
    description: 'Tiền đặt cọc (VND)',
  })
  deposit: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Đầy đủ',
    description: 'Tình trạng nội thất',
    required: false,
  })
  furnishing?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Sổ hồng',
    description: 'Giấy tờ pháp lý',
    required: false,
  })
  legalDoc?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'https://example.com/hero-image.jpg',
    description: 'Hình ảnh đại diện',
    required: false,
  })
  heroImage?: string;

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
