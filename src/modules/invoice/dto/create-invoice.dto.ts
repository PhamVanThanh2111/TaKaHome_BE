import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Tiền thuê phòng tháng 8/2024' })
  @IsString()
  description: string;

  @ApiProperty({ example: 8000000 })
  @IsNumber()
  amount: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'ceecf3f4-2317-46c6-9eeb-04d1f7fa9e53',
    description: 'ID hợp đồng',
  })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ example: '2024-08-30', description: 'Hạn thanh toán' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
