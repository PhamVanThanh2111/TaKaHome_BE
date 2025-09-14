import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { ContractStatusEnum } from '../../common/enums/contract-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'CT20240001', description: 'Mã hợp đồng' })
  contractCode: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'd3bc0bfe-cac7-4f0e-bbbd-d73c463bb8f1',
    description: 'ID người thuê (tenant)',
  })
  tenantId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '1bbff8eb-36c2-4ac9-91ba-5fd0e35f82f3',
    description: 'ID chủ nhà (landlord)',
  })
  landlordId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '443e2e1e-d55b-4c0d-8c29-5643fa14cbe7',
    description: 'ID bất động sản',
  })
  propertyId: string;

  @IsDateString()
  @ApiProperty({ example: '2024-07-01', description: 'Ngày bắt đầu' })
  startDate: Date;

  @IsDateString()
  @ApiProperty({ example: '2025-06-30', description: 'Ngày kết thúc' })
  endDate: Date;

  @IsEnum(ContractStatusEnum)
  @IsOptional()
  @ApiProperty({
    example: ContractStatusEnum.DRAFT,
    enum: ContractStatusEnum,
    required: false,
    description: 'Trạng thái hợp đồng',
  })
  status?: ContractStatusEnum;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'https://s3.amazonaws.com/contracts/ct1.pdf',
    required: false,
    description: 'URL file hợp đồng',
  })
  contractFileUrl?: string;
}
