import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

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
}
