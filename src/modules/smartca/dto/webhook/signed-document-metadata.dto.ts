import { IsString, IsNotEmpty, IsEnum, IsOptional } from "class-validator";

export enum SigningStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export class SignedDocumentMetadataDto {
  @IsString()
  @IsNotEmpty()
  doc_id: string;

  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsNotEmpty()
  original_filename: string;

  @IsString()
  @IsNotEmpty()
  file_type: string; // 'pdf' | 'xml'

  @IsEnum(SigningStatus)
  status: SigningStatus;

  @IsString()
  @IsOptional()
  signed_file_path?: string;

  @IsString()
  @IsOptional()
  signature_value?: string;

  @IsString()
  @IsOptional()
  timestamp_signature?: string;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsOptional()
  signed_at?: Date;

  @IsOptional()
  file_size?: number;
}