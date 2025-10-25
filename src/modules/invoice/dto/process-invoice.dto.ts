import { ApiProperty } from '@nestjs/swagger';

export class InvoiceExtractionResultDto {
  @ApiProperty({ description: 'Tên trường dữ liệu' })
  name: string;

  @ApiProperty({ description: 'Giá trị được trích xuất' })
  value: string;

  @ApiProperty({ description: 'Độ tin cậy (0-1)', example: 0.95 })
  confidence: number;
}

export class ProcessInvoiceResponseDto {
  @ApiProperty({ description: 'Trạng thái xử lý', example: 'success' })
  status: string;

  @ApiProperty({ description: 'Thông báo', example: 'Xử lý hóa đơn thành công' })
  message: string;

  @ApiProperty({ 
    type: [InvoiceExtractionResultDto], 
    description: 'Dữ liệu được trích xuất từ hóa đơn' 
  })
  extractedData: InvoiceExtractionResultDto[];

  @ApiProperty({ description: 'Dữ liệu thô từ Google Document AI', required: false })
  rawData?: any;
}