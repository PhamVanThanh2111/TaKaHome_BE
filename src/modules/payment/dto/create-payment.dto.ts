import {
  IsNotEmpty,
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

export class CreatePaymentDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'bbec70f2-6f54-4b3e-8e5d-43234a42ef6c',
    description: 'ID hợp đồng',
  })
  contractId: string;

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
