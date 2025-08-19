import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentDto } from './create-payment.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatusEnum } from 'src/modules/common/enums/payment-status.enum';

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {
  @ApiPropertyOptional({
    example: 'fd2c7dbb-7031-4d6c-a548-123b12f6e5cd',
    description: 'ID payment',
  })
  id?: string;

  @ApiPropertyOptional({
    example: PaymentStatusEnum.PAID,
    enum: PaymentStatusEnum,
  })
  status?: PaymentStatusEnum;
}
