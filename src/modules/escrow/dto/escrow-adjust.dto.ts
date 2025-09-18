import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
