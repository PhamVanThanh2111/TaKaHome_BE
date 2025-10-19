import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExtensionStatus } from '../entities/contract-extension.entity';

export class TenantRespondExtensionDto {
  @ApiProperty({
    description: 'Phản hồi của người thuê (đồng ý hoặc từ chối giá mới)',
    enum: [ExtensionStatus.APPROVED, ExtensionStatus.REJECTED],
    example: ExtensionStatus.APPROVED,
  })
  @IsNotEmpty()
  @IsEnum([ExtensionStatus.APPROVED, ExtensionStatus.REJECTED])
  status: ExtensionStatus.APPROVED | ExtensionStatus.REJECTED;

  @ApiProperty({
    description: 'Ghi chú từ người thuê',
    example: 'Tôi đồng ý với giá mới',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
