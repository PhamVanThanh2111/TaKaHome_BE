import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';

export class FilterPropertyWithUrlDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Giá từ (VND)' })
  fromPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Giá đến (VND)' })
  toPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Số phòng ngủ' })
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Số phòng tắm' })
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Diện tích từ (m2)' })
  fromArea?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Diện tích đến (m2)' })
  toArea?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: "Tình trạng nội thất ('Đầy đủ','Cơ bản','Không')",
  })
  furnishing?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Tỉnh/thành phố' })
  province?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Phường/xã' })
  ward?: string;

  @IsOptional()
  @IsEnum(PropertyTypeEnum)
  @ApiPropertyOptional({
    description: 'Loại bất động sản',
    enum: PropertyTypeEnum,
  })
  type?: PropertyTypeEnum;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên và mô tả',
  })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({
    description: 'Số lượng kết quả tối đa trả về',
    example: 10,
  })
  limit?: number;

  @IsOptional()
  @IsEnum(['price', 'area', 'createdAt'])
  @ApiPropertyOptional({
    description: 'Sắp xếp theo trường',
    enum: ['price', 'area', 'createdAt'],
    example: 'price',
  })
  sortBy?: 'price' | 'area' | 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    enum: ['asc', 'desc'],
    example: 'asc',
  })
  sortOrder?: 'asc' | 'desc';
}
