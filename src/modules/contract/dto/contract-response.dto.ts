import { ApiProperty } from '@nestjs/swagger';
import { ContractStatusEnum } from '../../common/enums/contract-status.enum';

export class ContractResponseDto {
  @ApiProperty({ example: 'ceecf3f4-2317-46c6-9eeb-04d1f7fa9e53' })
  id: string;

  @ApiProperty({ example: 'CT20240001' })
  contractCode: string;

  @ApiProperty({ example: 'd3bc0bfe-cac7-4f0e-bbbd-d73c463bb8f1' })
  tenantId: string;

  @ApiProperty({ example: '1bbff8eb-36c2-4ac9-91ba-5fd0e35f82f3' })
  landlordId: string;

  @ApiProperty({ example: '443e2e1e-d55b-4c0d-8c29-5643fa14cbe7' })
  propertyId: string;

  @ApiProperty({ example: '2024-07-01' })
  startDate: string;

  @ApiProperty({ example: '2025-06-30' })
  endDate: string;

  @ApiProperty({
    example: ContractStatusEnum.PENDING_SIGNATURE,
    enum: ContractStatusEnum,
  })
  status: ContractStatusEnum;

  @ApiProperty({
    example: 'https://s3.amazonaws.com/contracts/ct1.pdf',
    required: false,
  })
  contractFileUrl?: string;

  @ApiProperty({ example: '0x123abc...', required: false })
  blockchainTxHash?: string;

  @ApiProperty({ example: '0x789def...', required: false })
  smartContractAddress?: string;
}
