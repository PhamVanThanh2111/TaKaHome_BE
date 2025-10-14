import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';

export class FilterPropertyDto {
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
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'isApproved (true/false) - lọc theo trạng thái duyệt',
  })
  isApproved?: boolean;

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
  @ApiPropertyOptional({ description: 'Số trang (bắt đầu từ 1)', example: 1 })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ description: 'Số lượng item mỗi trang', example: 10 })
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
