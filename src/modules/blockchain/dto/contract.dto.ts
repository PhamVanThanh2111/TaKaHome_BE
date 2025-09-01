import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ContractStatus {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED'
}

export enum SignatureParty {
  LESSOR = 'lessor',
  LESSEE = 'lessee'
}

export class CreateBlockchainContractDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Lessor (landlord) identifier' })
  @IsNotEmpty()
  @IsString()
  lessorId: string;

  @ApiProperty({ description: 'Lessee (tenant) identifier' })
  @IsNotEmpty()
  @IsString()
  lesseeId: string;

  @ApiPropertyOptional({ description: 'Document hash for verification' })
  @IsOptional()
  @IsString()
  docHash?: string;

  @ApiProperty({ description: 'Monthly rent amount', minimum: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  rentAmount: number;

  @ApiPropertyOptional({ description: 'Security deposit amount', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Contract start date (ISO format)' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Contract end date (ISO format)' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

export class AddSignatureDto {
  @ApiProperty({ enum: SignatureParty, description: 'Signing party' })
  @IsNotEmpty()
  @IsEnum(SignatureParty)
  party: SignatureParty;

  @ApiProperty({ description: 'Certificate serial number' })
  @IsNotEmpty()
  @IsString()
  certSerial: string;

  @ApiProperty({ description: 'Signature metadata as JSON string' })
  @IsNotEmpty()
  @IsString()
  sigMetaJson: string;
}

export class QueryContractsDto {
  @ApiPropertyOptional({ enum: ContractStatus, description: 'Filter by contract status' })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Filter by party ID (lessor or lessee)' })
  @IsOptional()
  @IsString()
  party?: string;

  @ApiPropertyOptional({ description: 'Start date for date range query' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for date range query' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class TerminateContractDto {
  @ApiProperty({ description: 'Reason for contract termination' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
