import { PartialType } from '@nestjs/mapped-types';
import { CreateContractDto } from './create-contract.dto';
import { ContractStatusEnum } from 'src/modules/common/enums/contract-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContractDto extends PartialType(CreateContractDto) {
  @ApiPropertyOptional({
    example: 'ceecf3f4-2317-46c6-9eeb-04d1f7fa9e53',
    description: 'ID hợp đồng',
  })
  id?: string;

  @ApiPropertyOptional({
    example: ContractStatusEnum.ACTIVE,
    enum: ContractStatusEnum,
  })
  status?: ContractStatusEnum;
}
