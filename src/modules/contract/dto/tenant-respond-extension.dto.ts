import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExtensionStatus } from '../entities/contract-extension.entity';

export class TenantRespondExtensionDto {
  @ApiProperty({
    description: 'Phản hồi của người thuê (đồng ý hoặc từ chối giá mới)',
    enum: [ExtensionStatus.AWAITING_SIGNATURES, ExtensionStatus.REJECTED],
    example: ExtensionStatus.AWAITING_SIGNATURES,
  })
  @IsNotEmpty()
  @IsEnum([ExtensionStatus.AWAITING_SIGNATURES, ExtensionStatus.REJECTED])
  status: ExtensionStatus.AWAITING_SIGNATURES | ExtensionStatus.REJECTED;

  @ApiProperty({
    description: 'Ghi chú từ người thuê',
    example: 'Tôi đồng ý với giá mới',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
