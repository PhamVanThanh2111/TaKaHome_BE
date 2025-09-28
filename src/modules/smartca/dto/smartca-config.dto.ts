import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class SmartCAConfigDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsString()
  @IsNotEmpty()
  sp_password: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

        
}
