import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateAdminActionDto {
  @IsNotEmpty()
  adminId: string;

  @IsNotEmpty()
  targetId: string;

  @IsString()
  actionType: string;

  @IsOptional()
  @IsString()
  description?: string;
}
