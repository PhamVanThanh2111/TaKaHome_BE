import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { VerificationTypeEnum } from '../../common/enums/verification-type.enum';

export class CreateVerificationDto {
  @IsNotEmpty()
  userId: string;

  @IsEnum(VerificationTypeEnum)
  type: VerificationTypeEnum;

  @IsString()
  documentUrl: string;

  @IsOptional()
  verifiedById?: string;
}
