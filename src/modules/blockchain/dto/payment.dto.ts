import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

export class PaymentScheduleEntryDto {
  @ApiProperty({ description: 'Payment period (year as number)', example: 2025 })
  @IsNumber()
  @Type(() => Number)
  period: number;

  @ApiProperty({ description: 'Payment amount', minimum: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Due date for payment (ISO format)' })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;
}

export class CreatePaymentScheduleDto {
  @ApiProperty({ description: 'Total number of payment periods' })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  totalPeriods: number;

  @ApiProperty({ 
    description: 'Payment schedule entries',
    type: [PaymentScheduleEntryDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentScheduleEntryDto)
  schedule: PaymentScheduleEntryDto[];
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'Payment period identifier' })
  @IsNotEmpty()
  @IsString()
  period: string;

  @ApiProperty({ description: 'Payment amount', minimum: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Order reference number' })
  @IsNotEmpty()
  @IsString()
  orderRef: string;
}

export class ApplyPenaltyDto {
  @ApiProperty({ description: 'Payment period to apply penalty to' })
  @IsNotEmpty()
  @IsString()
  period: string;

  @ApiProperty({ enum: PenaltyType, description: 'Type of penalty' })
  @IsNotEmpty()
  @IsEnum(PenaltyType)
  penaltyType: PenaltyType;

  @ApiProperty({ description: 'Penalty amount', minimum: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Reason for penalty' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Due date for penalty payment' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class QueryPaymentsDto {
  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Filter by payment status' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Filter by contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Filter by period' })
  @IsOptional()
  @IsString()
  period?: string;
}

export class MarkOverdueDto {
  @ApiPropertyOptional({ description: 'Additional notes for overdue marking' })
  @IsOptional()
  @IsString()
  notes?: string;
}
