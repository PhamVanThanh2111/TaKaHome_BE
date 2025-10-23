import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  ValidateIf,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceTypeEnum } from '../../common/enums/service-type.enum';

export class CreateUtilityBillDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'ID của hợp đồng',
  })
  contractId: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({
    example: '2025-01-31',
    description: 'Hạn thanh toán (YYYY-MM-DD)',
  })
  dueDate: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: '2025-01',
    description: 'Kỳ thanh toán (YYYY-MM)',
  })
  billingPeriod: string;

  @IsNotEmpty()
  @IsEnum(ServiceTypeEnum)
  @ApiProperty({
    enum: ServiceTypeEnum,
    description: 'Loại dịch vụ',
    example: ServiceTypeEnum.ELECTRICITY,
  })
  serviceType: ServiceTypeEnum;

  @IsOptional()
  @IsNumber()
  @ValidateIf((obj: CreateUtilityBillDto) => !obj.M3No) // KwhNo bắt buộc nếu không có M3No
  @ApiProperty({
    example: 150,
    description: 'Số lượng kWh sử dụng (chỉ cho hóa đơn tiền điện)',
    required: false,
  })
  KwhNo?: number;

  @IsOptional()
  @IsNumber()
  @ValidateIf((obj: CreateUtilityBillDto) => !obj.KwhNo) // M3No bắt buộc nếu không có KwhNo
  @ApiProperty({
    example: 5,
    description: 'Số lượng m³ nước sử dụng (chỉ cho hóa đơn tiền nước)',
    required: false,
  })
  M3No?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    example: 1000000,
    description: 'Tổng số tiền của hóa đơn - Với trường hợp không phải là tiền điện hoặc nước',
    required: false,
  })
  amount?: number;
}
