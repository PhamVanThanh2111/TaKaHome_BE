import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApartmentDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Căn hộ Masteri cập nhật',
    description: 'Tiêu đề căn hộ',
  })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Căn hộ 2PN view sông, đầy đủ tiện nghi mới',
    description: 'Mô tả chi tiết căn hộ',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Thành phố Hồ Chí Minh',
    description: 'Tỉnh/Thành phố',
  })
  province?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Quận/Huyện',
  })
  ward?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: '123 Lê Lợi, Quận 1',
    description: 'Địa chỉ căn hộ',
  })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Block A',
    description: 'Tên block/tòa nhà',
  })
  block?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'A-1001',
    description: 'Số căn hộ/unit',
  })
  unit?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    example: 25,
    description: 'Diện tích (m²)',
  })
  area?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    example: 2,
    description: 'Số phòng ngủ',
  })
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    example: 2,
    description: 'Số phòng tắm',
  })
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    example: 15000000,
    description: 'Giá tiền cho thuê (VND/tháng)',
  })
  price?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    example: 30000000,
    description: 'Tiền đặt cọc (VND)',
  })
  deposit?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Đầy đủ',
    description: 'Mức độ nội thất (Cơ bản, Nửa đủ, Đầy đủ)',
  })
  furnishing?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'https://example.com/documents/legal.pdf',
    description: 'Liên kết tới tài liệu pháp lý',
  })
  legalDoc?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'https://example.com/hero-image.jpg',
    description: 'Ảnh đại diện',
  })
  heroImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    description: 'Danh sách hình ảnh',
  })
  images?: string[];
}
