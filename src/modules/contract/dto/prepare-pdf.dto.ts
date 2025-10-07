import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumberString, IsString, IsEmail } from 'class-validator';

export class PreparePDFDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File PDF cần chuẩn bị',
  })
  @IsOptional()
  pdf?: any;

  @ApiPropertyOptional({ description: 'Trang (bắt đầu từ 0)', example: '0' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({
    description: 'BBox [llx,lly,urx,ury]',
    example: '[50,50,250,120]',
  })
  @IsOptional()
  @IsString()
  rect?: string;

  @ApiPropertyOptional({
    description: 'Độ dài vùng Contents',
    example: '4096',
  })
  @IsOptional()
  @IsNumberString()
  signatureLength?: string;

  // === NEAC Compliance Fields ===
  @ApiPropertyOptional({
    description: 'Lý do ký (Reason)',
    example: 'Ký hợp đồng thuê nhà',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Địa điểm ký (Location)',
    example: 'Hà Nội, Việt Nam',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Email liên hệ (ContactInfo)',
    example: 'thanhpham21dev@gmail.com',
  })
  @IsOptional()
  @IsEmail()
  contactInfo?: string;

  @ApiPropertyOptional({
    description: 'Tên người ký (Name)',
    example: 'Phạm Văn Thành',
  })
  @IsOptional()
  @IsString()
  signerName?: string;

  @ApiPropertyOptional({
    description: 'Creator/Application name',
    example: 'SmartCA VNPT 2025',
  })
  @IsOptional()
  @IsString()
  creator?: string;
}
