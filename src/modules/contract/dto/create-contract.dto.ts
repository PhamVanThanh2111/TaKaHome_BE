import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { ContractStatusEnum } from '../../common/enums/contract-status.enum';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  contractCode: string;

  @IsNotEmpty()
  tenantId: string;

  @IsNotEmpty()
  landlordId: string;

  @IsNotEmpty()
  propertyId: string;

  @IsDateString()
  startDate: Date;

  @IsDateString()
  endDate: Date;

  @IsEnum(ContractStatusEnum)
  @IsOptional()
  status?: ContractStatusEnum;

  @IsOptional()
  @IsString()
  contractFileUrl?: string;
}
