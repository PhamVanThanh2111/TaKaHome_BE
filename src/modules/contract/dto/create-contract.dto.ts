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
  tenantId: number;

  @IsNotEmpty()
  landlordId: number;

  @IsNotEmpty()
  propertyId: number;

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
