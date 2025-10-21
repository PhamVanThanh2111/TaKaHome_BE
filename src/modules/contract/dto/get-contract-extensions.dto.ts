import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetContractExtensionsDto {
  @ApiProperty({
    description: 'ID của contract cần lấy danh sách extension',
  })
  @IsNotEmpty()
  @IsUUID()
  contractId: string;
}