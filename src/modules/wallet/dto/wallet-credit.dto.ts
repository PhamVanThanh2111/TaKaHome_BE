import {
  IsInt,
  Min,
  IsOptional,
  IsIn,
  IsUUID,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class WalletCreditDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amount: number; // VND

  @IsIn(['TOPUP', 'REFUND', 'ADJUSTMENT'])
  type: 'TOPUP' | 'REFUND' | 'ADJUSTMENT';

  @IsOptional()
  @IsIn(['TOPUP', 'PAYMENT', 'CONTRACT'])
  refType?: 'TOPUP' | 'PAYMENT' | 'CONTRACT';

  @IsOptional()
  @IsUUID()
  refId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
