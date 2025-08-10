import { IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { StatusEnum } from '../../common/enums/status.enum';
import { ApiProperty } from '@nestjs/swagger';

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
    example: PaymentMethodEnum.CASH,
    enum: PaymentMethodEnum,
    description: 'Phương thức thanh toán',
  })
  method: PaymentMethodEnum;

  @IsEnum(StatusEnum)
  @ApiProperty({
    example: StatusEnum.PENDING,
    enum: StatusEnum,
    required: false,
    description: 'Trạng thái thanh toán',
  })
  status?: StatusEnum;
}
