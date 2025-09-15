import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CertificateRequestDto {
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
  @IsOptional()
  serial_number?: string;

  
  @IsString()
  @IsNotEmpty()
  transaction_id: string;
}
