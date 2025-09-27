import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
  SCHEDULED = 'SCHEDULED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export enum PenaltyType {
  LATE_PAYMENT = 'LATE_PAYMENT',
  DAMAGE = 'DAMAGE',
  OTHER = 'OTHER'
}



export class RecordContractPenaltyDto {
  @ApiProperty({ enum: ['landlord', 'tenant'], description: 'Party receiving penalty' })
  @IsNotEmpty()
  @IsEnum(['landlord', 'tenant'])
  party: string;

  @ApiProperty({ description: 'Penalty amount (string for precision)' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Penalty reason (required)' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class QueryPaymentsDto {
  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Filter by payment status' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class MarkOverdueDto {
  @ApiProperty({ description: 'Payment period number' })
  @IsNotEmpty()
  @IsString()
  period: string;
}