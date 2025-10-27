import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ContractStatus {
  WAIT_TENANT_SIGNATURE = 'WAIT_TENANT_SIGNATURE',
  WAIT_DEPOSIT = 'WAIT_DEPOSIT',
  WAIT_FIRST_PAYMENT = 'WAIT_FIRST_PAYMENT',
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED',
}

export enum SignatureParty {
  LANDLORD = 'landlord',
  TENANT = 'tenant',
}

export class CreateBlockchainContractDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Landlord identifier' })
  @IsNotEmpty()
  @IsString()
  landlordId: string;

  @ApiProperty({ description: 'Tenant identifier' })
  @IsNotEmpty()
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Landlord MSP', default: 'OrgLandlordMSP' })
  @IsNotEmpty()
  @IsString()
  landlordMSP: string;

  @ApiProperty({ description: 'Tenant MSP', default: 'OrgTenantMSP' })
  @IsNotEmpty()
  @IsString()
  tenantMSP: string;

  @ApiProperty({ description: 'Landlord certificate ID' })
  @IsNotEmpty()
  @IsString()
  landlordCertId: string;

  @ApiProperty({ description: 'Tenant certificate ID' })
  @IsNotEmpty()
  @IsString()
  tenantCertId: string;

  @ApiProperty({ description: 'Hash of landlord-signed contract file' })
  @IsNotEmpty()
  @IsString()
  signedContractFileHash: string;

  @ApiProperty({ description: 'JSON metadata about landlord signature' })
  @IsNotEmpty()
  @IsString()
  landlordSignatureMeta: string;

  @ApiProperty({
    description: 'Monthly rent amount (will be converted to cents/đồng)',
  })
  @IsNotEmpty()
  @IsString()
  rentAmount: string;

  @ApiProperty({
    description: 'Security deposit amount (will be converted to cents/đồng)',
  })
  @IsNotEmpty()
  @IsString()
  depositAmount: string;

  @ApiProperty({
    description: 'Currency code',
    enum: ['VND', 'USD', 'EUR', 'SGD'],
  })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Contract start date (ISO 8601 format)' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Contract end date (ISO 8601 format)' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

export class TenantSignContractDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Hash of fully-signed contract file' })
  @IsNotEmpty()
  @IsString()
  fullySignedContractFileHash: string;

  @ApiProperty({ description: 'JSON metadata about tenant signature' })
  @IsNotEmpty()
  @IsString()
  tenantSignatureMeta: string;
}

export class RecordDepositDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({
    description: 'Party making deposit',
    enum: ['landlord', 'tenant'],
  })
  @IsNotEmpty()
  @IsString()
  party: string;

  @ApiProperty({
    description: 'Deposit amount (will be converted to cents/đồng)',
  })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Transaction reference' })
  @IsNotEmpty()
  @IsString()
  depositTxRef: string;
}

export class RecordFirstPaymentDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Payment amount (must match rent amount)' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Transaction reference' })
  @IsNotEmpty()
  @IsString()
  paymentTxRef: string;
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Payment period number (2, 3, 4, etc.)' })
  @IsNotEmpty()
  @IsString()
  period: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiPropertyOptional({ description: 'Unique order reference' })
  @IsOptional()
  @IsString()
  orderRef?: string;
}

export class ApplyPenaltyDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Payment period number' })
  @IsNotEmpty()
  @IsString()
  period: string;

  @ApiProperty({ description: 'Penalty amount' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiPropertyOptional({ description: 'Policy reference' })
  @IsOptional()
  @IsString()
  policyRef?: string;

  @ApiProperty({ description: 'Penalty reason' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class RecordPenaltyDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({
    description: 'Party being penalized',
    enum: ['landlord', 'tenant'],
  })
  @IsNotEmpty()
  @IsString()
  party: string;

  @ApiProperty({ description: 'Penalty amount' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Penalty reason' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class StorePrivateDetailsDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Private data as JSON string' })
  @IsNotEmpty()
  @IsString()
  privateDataJson: string;
}

export class QueryContractsDto {
  @ApiPropertyOptional({
    enum: ContractStatus,
    description: 'Filter by contract status',
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({
    description: 'Filter by party ID (landlord or tenant)',
  })
  @IsOptional()
  @IsString()
  party?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range query (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range query (ISO 8601)',
  })
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

export class RecordContractExtensionDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'New contract end date (ISO 8601 format)' })
  @IsNotEmpty()
  @IsDateString()
  newEndDate: string;

  @ApiProperty({
    description: 'New monthly rent amount (will be converted to cents/đồng)',
  })
  @IsNotEmpty()
  @IsString()
  newRentAmount: string;

  @ApiPropertyOptional({ description: 'Hash of extension agreement document' })
  @IsOptional()
  @IsString()
  extensionAgreementHash?: string;

  @ApiPropertyOptional({ description: 'Notes about the extension' })
  @IsOptional()
  @IsString()
  extensionNotes?: string;
}

export class CreateExtensionPaymentScheduleDto {
  @ApiProperty({ description: 'Unique contract identifier' })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({
    description: 'Extension number to create payment schedule for',
  })
  @IsNotEmpty()
  @IsString()
  extensionNumber: string;
}
