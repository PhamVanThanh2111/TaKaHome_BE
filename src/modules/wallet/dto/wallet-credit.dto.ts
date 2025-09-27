import {
  IsInt,
  Min,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { WalletTxnType } from 'src/modules/common/enums/wallet-txn-type.enum';

export class WalletCreditDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amount: number; // VND

  type: WalletTxnType;

  @IsOptional()
  @IsUUID()
  refId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
