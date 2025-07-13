import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
} from 'class-validator';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';
import { ApiProperty } from '@nestjs/swagger';

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

  @IsString()
  @ApiProperty({
    example: '123 Lê Lợi, Quận 1, TP.HCM',
    description: 'Địa chỉ',
  })
  address: string;

  @IsEnum(PropertyTypeEnum)
  @ApiProperty({
    example: PropertyTypeEnum.APARTMENT,
    enum: PropertyTypeEnum,
    description: 'Loại bất động sản',
  })
  type: PropertyTypeEnum;

  @IsNumber()
  @ApiProperty({ example: 12000000, description: 'Giá thuê mỗi tháng (VND)' })
  price: number;

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

  @ApiProperty({
    example: '6a36daba-79e1-4de8-8db5-281d8f6a81c1',
    description: 'ID chủ nhà (landlord)',
  })
  landlordId: string;
}
