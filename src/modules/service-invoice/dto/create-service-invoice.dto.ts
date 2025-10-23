import { IsEnum, IsUUID, IsNumber, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceTypeEnum } from '../../common/enums/service-type.enum';

export class CreateServiceInvoiceDto {
  @ApiProperty({ enum: ServiceTypeEnum, description: 'Loại dịch vụ' })
  @IsEnum(ServiceTypeEnum)
  type: ServiceTypeEnum;

  @ApiProperty({ description: 'ID hợp đồng' })
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'Số tiền', example: 500000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Hạn thanh toán', example: '2025-01-30T00:00:00Z' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Tên nhà cung cấp dịch vụ' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ nhà cung cấp' })
  @IsOptional()
  @IsString()
  providerAddress?: string;

  @ApiPropertyOptional({ description: 'Số hóa đơn gốc' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Ngày lập hóa đơn gốc' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ description: 'Lượng tiêu thụ' })
  @IsOptional()
  @IsNumber()
  consumption?: number;

  @ApiPropertyOptional({ description: 'Đơn vị (kWh, m3, tháng, etc.)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Đơn giá' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'URL hình ảnh hóa đơn gốc' })
  @IsOptional()
  @IsString()
  originalInvoiceImageUrl?: string;
}