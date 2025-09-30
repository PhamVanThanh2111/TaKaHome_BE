import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class SignedFileDto {
  @IsString()
  @IsNotEmpty()
  doc_id: string;

  @IsString()
  @IsOptional()
  signature_value?: string;

  @IsString()
  @IsOptional()
  timestamp_signature?: string;
}

export class SmartCAWebhookDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsNumber()
  @IsNotEmpty()
  status_code: number;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignedFileDto)
  signed_files: SignedFileDto[];
}