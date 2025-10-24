import { IsNotEmpty, IsNumber, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceTypeEnum } from '../../common/enums/service-type.enum';

export class ServiceItemDto {
  @IsNotEmpty()
  @IsEnum(ServiceTypeEnum)
  @ApiProperty({
    enum: ServiceTypeEnum,
    description: 'Loại dịch vụ',
    example: ServiceTypeEnum.PARKING,
  })
  serviceType: ServiceTypeEnum;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    example: 50000,
    description: 'Số tiền của dịch vụ (VND)',
  })
  amount?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Tiền gửi xe máy tháng 01/2025',
    description: 'Mô tả chi tiết cho dịch vụ (tùy chọn)',
    required: false,
  })
  description?: string;

  @IsOptional()
  @IsNumber()
  @ValidateIf((obj: ServiceItemDto) => obj.serviceType === ServiceTypeEnum.ELECTRICITY)
  @ApiProperty({
    example: 150,
    description: 'Số lượng kWh (chỉ dành cho ELECTRICITY)',
    required: false,
  })
  KwhNo?: number;

  @IsOptional()
  @IsNumber()
  @ValidateIf((obj: ServiceItemDto) => obj.serviceType === ServiceTypeEnum.WATER)
  @ApiProperty({
    example: 5,
    description: 'Số lượng m³ nước (chỉ dành cho WATER)',
    required: false,
  })
  M3No?: number;
}