import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class CreateContractExtensionDto {
  @ApiProperty({
    description: 'ID của hợp đồng cần gia hạn',
  })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({
    description: 'Số tháng muốn gia hạn (1-24 tháng)',
    example: 12,
    minimum: 1,
    maximum: 24,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(24)
  extensionMonths: number;

  @ApiProperty({
    description: 'Ghi chú từ người thuê',
    example: 'Tôi muốn gia hạn hợp đồng thêm 12 tháng',
    required: false,
  })
  @IsOptional()
  @IsString()
  requestNote?: string;
}
