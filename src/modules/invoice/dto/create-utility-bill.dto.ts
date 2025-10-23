import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceItemDto } from './service-item.dto';

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  @ApiProperty({
    type: [ServiceItemDto],
    description: 'Danh sách các dịch vụ và số tiền tương ứng',
    example: [
      {
        serviceType: 'PARKING',
        amount: 50000,
        description: 'Tiền gửi xe máy tháng 01/2025',
      },
      {
        serviceType: 'INTERNET',
        amount: 200000,
        description: 'Tiền internet tháng 01/2025',
      },
    ],
  })
  services: ServiceItemDto[];
}
