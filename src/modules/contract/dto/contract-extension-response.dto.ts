import { ApiProperty } from '@nestjs/swagger';
import { ExtensionStatus } from '../entities/contract-extension.entity';

export class ContractExtensionResponseDto {
  @ApiProperty({
    description: 'ID của contract extension',
    example: 'a1234567-89ab-cdef-0123-456789abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'ID của contract',
    example: 'b1234567-89ab-cdef-0123-456789abcdef',
  })
  contractId: string;

  @ApiProperty({
    description: 'Số tháng muốn gia hạn',
    example: 6,
  })
  extensionMonths: number;

  @ApiProperty({
    description: 'Giá thuê mới (nếu có)',
    example: 5000000,
    required: false,
  })
  newMonthlyRent?: number;

  @ApiProperty({
    description: 'Ghi chú từ người thuê',
    example: 'Mong muốn gia hạn thêm 6 tháng nữa',
    required: false,
  })
  requestNote?: string;

  @ApiProperty({
    description: 'Ghi chú phản hồi từ chủ nhà',
    example: 'Đồng ý gia hạn với giá mới',
    required: false,
  })
  responseNote?: string;

  @ApiProperty({
    description: 'Trạng thái của yêu cầu gia hạn',
    enum: ExtensionStatus,
    example: ExtensionStatus.PENDING,
  })
  status: ExtensionStatus;

  @ApiProperty({
    description: 'Thời gian chủ nhà phản hồi',
    example: '2025-01-15T10:30:00.000Z',
    required: false,
  })
  respondedAt?: Date;

  @ApiProperty({
    description: 'URL file hợp đồng gia hạn',
    required: false,
  })
  extensionContractFileUrl?: string;

  @ApiProperty({
    description: 'Thời gian chủ nhà ký',
    required: false,
  })
  landlordSignedAt?: Date;

  @ApiProperty({
    description: 'Thời gian tenant ký',
    required: false,
  })
  tenantSignedAt?: Date;

  @ApiProperty({
    description: 'Hạn đóng ký quỹ',
    required: false,
  })
  escrowDepositDueAt?: Date;

  @ApiProperty({
    description: 'Thời gian tenant đóng ký quỹ',
    required: false,
  })
  tenantEscrowDepositFundedAt?: Date;

  @ApiProperty({
    description: 'Thời gian landlord đóng ký quỹ',
    required: false,
  })
  landlordEscrowDepositFundedAt?: Date;

  @ApiProperty({
    description: 'Thời gian extension có hiệu lực',
    required: false,
  })
  activatedAt?: Date;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2025-01-10T09:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật',
    example: '2025-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}