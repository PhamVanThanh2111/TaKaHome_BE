import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { StatusEnum } from '../../common/enums/status.enum';

export class PaymentResponseDto {
  @ApiProperty({ example: 'fd2c7dbb-7031-4d6c-a548-123b12f6e5cd' })
  id: string;

  @ApiProperty({ example: 'bbec70f2-6f54-4b3e-8e5d-43234a42ef6c' })
  contractId: string;

  @ApiProperty({ example: 12000000 })
  amount: number;

  @ApiProperty({
    example: PaymentMethodEnum.BANK_TRANSFER,
    enum: PaymentMethodEnum,
  })
  method: PaymentMethodEnum;

  @ApiProperty({ example: StatusEnum.PENDING, enum: StatusEnum })
  status: StatusEnum;
}
