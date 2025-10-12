import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatusEnum } from '../../common/enums/invoice-status.enum';

export class InvoiceItemResponseDto {
  @ApiProperty({ example: '1bbff8eb-36c2-4ac9-91ba-5fd0e35f82f3' })
  id: string;

  @ApiProperty({ example: 'Tiền thuê phòng tháng 8/2024' })
  description: string;

  @ApiProperty({ example: 8000000 })
  amount: number;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: 'ceecf3f4-2317-46c6-9eeb-04d1f7fa9e53' })
  id: string;

  @ApiProperty({ example: 'INV2024080001' })
  invoiceCode: string;

  @ApiProperty({ example: 'd3bc0bfe-cac7-4f0e-bbbd-d73c463bb8f1' })
  contractId: string;

  @ApiProperty({ type: [InvoiceItemResponseDto] })
  items: InvoiceItemResponseDto[];

  @ApiProperty({ example: 8000000 })
  totalAmount: number;

  @ApiProperty({ example: '2024-08-30' })
  dueDate: string;

  @ApiProperty({ example: InvoiceStatusEnum.PENDING, enum: InvoiceStatusEnum })
  status: InvoiceStatusEnum;

  @ApiProperty({ example: '2024-08' })
  billingPeriod?: string;
}
