import {
  IsInt,
  Min,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { WalletTxnType } from 'src/modules/common/enums/wallet-txn-type.enum';

export class WalletDebitDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amount: number; // VND

  // business: dùng khi trừ tiền trả hợp đồng
  type: WalletTxnType;

  @IsUUID()
  refId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
