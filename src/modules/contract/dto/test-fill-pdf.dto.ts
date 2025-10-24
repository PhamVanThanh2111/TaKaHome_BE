import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class TestFillPdfDto {
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
    description: 'Địa chỉ bất động sản',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  property_address?: string;

  @ApiProperty({
    description: 'Giá thuê hàng tháng',
    example: '5.000.000 VNĐ',
    required: false,
  })
  @IsOptional()
  @IsString()
  rent_amount?: string;

  @ApiProperty({
    description: 'Ngày bắt đầu hợp đồng',
    example: '01/01/2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiProperty({
    description: 'Ngày kết thúc hợp đồng',
    example: '31/12/2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  end_date?: string;
}
