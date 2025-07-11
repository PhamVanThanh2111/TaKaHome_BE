import { IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { StatusEnum } from '../../common/enums/status.enum';

export class CreatePaymentDto {
  @IsNotEmpty()
  contractId: number;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;

  @IsEnum(StatusEnum)
  status?: StatusEnum;
}
