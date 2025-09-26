import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumberString, IsString } from 'class-validator';

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
    example: '12000',
  })
  @IsOptional()
  @IsNumberString()
  signatureLength?: string;

  // placeholder #2
  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  page2?: string;

  @ApiPropertyOptional({ example: '[300,50,500,120]' })
  @IsOptional()
  @IsString()
  rect2?: string;

  @ApiPropertyOptional({ example: '12000' })
  @IsOptional()
  @IsNumberString()
  signatureLength2?: string;
}
