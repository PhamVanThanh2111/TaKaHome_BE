import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaymentPurpose } from 'src/modules/common/enums/payment-purpose.enum';

export class CreatePaymentDto {
  @IsOptional()
  @ApiProperty({ example: 'contract_123', description: 'ID hợp đồng' })
  contractId?: string;

  @IsNumber()
  @ApiProperty({ example: 12000000, description: 'Số tiền thanh toán (VND)' })
  amount: number;

  @IsEnum(PaymentMethodEnum)
  @ApiProperty({
    example: PaymentMethodEnum.VNPAY,
    enum: PaymentMethodEnum,
    description: 'Phương thức thanh toán',
  })
  method: PaymentMethodEnum;

  @IsEnum(PaymentPurpose)
  @ApiProperty({
    required: false,
    enum: PaymentPurpose,
    description: 'Mục đích thanh toán (ví dụ: ESCROW_DEPOSIT)',
  })
  purpose: PaymentPurpose;

  // VNPAY
  @IsOptional()
  @IsString()
  @MaxLength(255)
  orderInfo?: string;

  @IsOptional()
  @IsIn(['vn', 'en'])
  locale?: 'vn';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(5)
  expireIn?: number; // minutes

  
}
