import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import {
  ESCROW_BALANCE_PARTIES,
  EscrowBalanceParty,
} from '../entities/escrow.entity';

export class EscrowAdjustDto {
  @ApiProperty({ example: 5000000, description: 'Số tiền (VND)' })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({
    required: false,
    example: 'Khấu trừ do hư hại tài sản',
    description: 'Ghi chú giao dịch',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    enum: ESCROW_BALANCE_PARTIES,
    example: 'TENANT',
    description: 'Đối tượng ký quỹ cần điều chỉnh',
  })
  @IsOptional()
  @IsIn(ESCROW_BALANCE_PARTIES)
  party?: EscrowBalanceParty;
}
