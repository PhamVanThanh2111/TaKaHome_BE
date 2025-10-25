import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ServiceTypeEnum } from 'src/modules/common/enums/service-type.enum';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Tiền thuê phòng tháng 8/2024' })
  @IsString()
  description: string;

  @ApiProperty({ example: 8000000 })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: ServiceTypeEnum.RENT,
    description: 'Loại dịch vụ (nếu là hóa đơn dịch vụ)',
  })
  @IsOptional()
  @IsEnum(ServiceTypeEnum)
  serviceType?: ServiceTypeEnum;
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

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'billingPeriod phải là YYYY-MM',
  })
  billingPeriod?: string;
}
