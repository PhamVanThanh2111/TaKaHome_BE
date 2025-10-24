import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { PdfTemplateType } from '../pdf-fill.service';

export class FillPdfDto {
  @ApiProperty({
    description: 'Loại file PDF template cần điền',
    enum: PdfTemplateType,
    example: PdfTemplateType.HOP_DONG_CHO_THUE_NHA_NGUYEN_CAN,
  })
  @IsNotEmpty()
  @IsEnum(PdfTemplateType)
  templateType: PdfTemplateType;

  @ApiProperty({
    description: 'Tên chủ nhà',
    example: 'Nguyễn Văn A',
  })
  @IsNotEmpty()
  @IsString()
  landlord_name: string;

  @ApiProperty({
    description: 'Tên người thuê',
    example: 'Trần Thị B',
  })
  @IsNotEmpty()
  @IsString()
  tenant_name: string;

  @ApiProperty({
    description: 'CCCD chủ nhà',
    example: '001234567890',
  })
  @IsNotEmpty()
  @IsString()
  landlord_cccd: string;

  @ApiProperty({
    description: 'CCCD người thuê',
    example: '009876543210',
  })
  @IsNotEmpty()
  @IsString()
  tenant_cccd: string;

  @ApiProperty({
    description: 'Số điện thoại chủ nhà',
    example: '0901234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  landlord_phone?: string;

  @ApiProperty({
    description: 'Số điện thoại người thuê',
    example: '0909876543',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenant_phone?: string;

  @ApiProperty({
    description: 'Địa chỉ bất động sản',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Diện tích bất động sản',
    example: '20m2',
    required: false,
  })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiProperty({
    description: 'Giá thuê hàng tháng',
    example: '5.000.000 VNĐ',
    required: false,
  })
  @IsOptional()
  @IsString()
  rent?: string;

  @ApiProperty({
    description: 'Số tiền đặt cọc',
    example: '10.000.000 VNĐ',
    required: false,
  })
  @IsOptional()
  @IsString()
  deposit?: string;

  @ApiProperty({
    description: 'Ngày bắt đầu hợp đồng',
    example: '01/01/2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({
    description: 'Chữ ký chủ nhà',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsOptional()
  @IsString()
  landlord_sign?: string;

  @ApiProperty({
    description: 'Chữ ký người thuê',
    example: 'Trần Thị B',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenant_sign?: string;
}
