import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ExtensionStatus } from '../entities/contract-extension.entity';

export class RespondContractExtensionDto {
  @ApiProperty({
    description: 'Phản hồi của chủ nhà (respond với giá mới hoặc reject)',
    enum: [ExtensionStatus.LANDLORD_RESPONDED, ExtensionStatus.REJECTED],
    example: ExtensionStatus.LANDLORD_RESPONDED,
  })
  @IsNotEmpty()
  @IsEnum([ExtensionStatus.LANDLORD_RESPONDED, ExtensionStatus.REJECTED])
  status: ExtensionStatus.LANDLORD_RESPONDED | ExtensionStatus.REJECTED;

  @ApiProperty({
    description: 'Ghi chú phản hồi từ chủ nhà',
    example: 'Đồng ý gia hạn với điều kiện tăng giá thuê',
    required: false,
  })
  @IsOptional()
  @IsString()
  responseNote?: string;

  @ApiProperty({
    description: 'Giá thuê mới (bắt buộc nếu status là LANDLORD_RESPONDED)',
    example: 15000000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  newMonthlyRent?: number;

  @ApiProperty({
    description: 'Giá điện mới (chỉ áp dụng với BOARDING)',
    example: 3500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  newElectricityPrice?: number;

  @ApiProperty({
    description: 'Giá nước mới (chỉ áp dụng với BOARDING)',
    example: 25000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  newWaterPrice?: number;
}
