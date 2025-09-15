import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class SignFileDto {
  @IsString()
  @IsNotEmpty()
  data_to_be_signed: string;

  @IsString()
  @IsNotEmpty()
  doc_id: string;

  @IsString()
  @IsNotEmpty()
  file_type: string; // 'pdf' | 'xml'

  @IsString()
  @IsNotEmpty()
  sign_type: string; // 'hash'
}

export class SignRequestDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsString()
  @IsNotEmpty()
  sp_password: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  serial_number: string;

  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsOptional()
  time_stamp?: string;

  @IsString()
  @IsOptional()
  transaction_desc?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignFileDto)
  sign_files: SignFileDto[];
}
