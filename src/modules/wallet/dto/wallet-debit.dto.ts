import {
  IsInt,
  Min,
  IsIn,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class WalletDebitDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amount: number; // VND

  // business: dùng khi trừ tiền trả hợp đồng
  @IsIn(['CONTRACT_PAYMENT'])
  type: 'CONTRACT_PAYMENT';

  @IsIn(['PAYMENT', 'CONTRACT'])
  refType: 'PAYMENT' | 'CONTRACT';

  @IsUUID()
  refId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
