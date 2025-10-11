import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { CreateFloorDto } from './create-floor.dto';
import { CreateRoomTypeDto } from './create-room-type.dto';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Căn hộ Masteri',
    description: 'Tiêu đề bất động sản',
  })
  title: string;

  @IsString()
  @ApiProperty({
    example: 'Căn hộ 2PN view sông, đầy đủ tiện nghi',
    description: 'Mô tả chi tiết',
  })
  description: string;

  @IsEnum(PropertyTypeEnum)
  @ApiProperty({
    example: PropertyTypeEnum.APARTMENT,
    enum: PropertyTypeEnum,
    description: 'Loại bất động sản',
  })
  type: PropertyTypeEnum;

  @IsString()
  @ApiProperty({
    example: 'Thành phố Hồ Chí Minh',
    description: 'Tỉnh/Thành phố',
  })
  province: string;

  @IsString()
  @ApiProperty({
    example: 'Gò Vấp',
    description: 'Phường/Xã',
  })
  ward: string;

  @IsString()
  @ApiProperty({
    example: '123 Lê Lợi',
    description: 'Địa chỉ',
  })
  address: string;

  @IsString()
  @ApiProperty({
    example: 'Đầy đủ',
    description: 'Tình trạng nội thất',
  })
  furnishing: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 12000000, description: 'Giá thuê mỗi tháng (VND)' })
  price?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 3000000, description: 'Tiền đặt cọc (VND)' })
  deposit?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 80, description: 'Diện tích (m2)', required: false })
  area?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2, description: 'Số phòng ngủ', required: false })
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 2, description: 'Số phòng tắm', required: false })
  bathrooms?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: '10.7769,106.7009',
    description: 'Toạ độ bản đồ',
    required: false,
  })
  mapLocation?: string;

  // === Additional fields from entity ===
  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Block A',
    description: 'Tên block/khu (cho chung cư)',
    required: false,
  })
  block?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Sổ hồng',
    description: 'Giấy tờ pháp lý',
    required: false,
  })
  legalDoc?: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    example: 3500,
    description: 'Giá điện (VND/kWh)',
    required: false,
  })
  electricityPricePerKwh?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    example: 25000,
    description: 'Giá nước (VND/m3)',
    required: false,
  })
  waterPricePerM3?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Hiển thị công khai',
    required: false,
    default: true,
  })
  isVisible?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'https://example.com/hero-image.jpg',
    description: 'Ảnh đại diện',
    required: false,
  })
  heroImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    description: 'Danh sách hình ảnh',
    required: false,
  })
  images?: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'A1-101',
    description: 'Số căn hộ/phòng',
    required: false,
  })
  unit?: string;

  // === BOARDING-specific fields ===
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFloorDto)
  @ApiProperty({
    type: [CreateFloorDto],
    description: 'Danh sách tầng (chỉ cho loại BOARDING)',
    required: false,
  })
  floors?: CreateFloorDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoomTypeDto)
  @ApiProperty({
    type: [CreateRoomTypeDto],
    description: 'Danh sách loại phòng (chỉ cho loại BOARDING)',
    required: false,
  })
  roomTypes?: CreateRoomTypeDto[];
}
