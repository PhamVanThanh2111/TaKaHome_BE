import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TerminationRequestStatus } from '../entities/contract-termination-request.entity';

export class RespondTerminationRequestDto {
  @ApiProperty({
    description: 'Trạng thái phản hồi',
    enum: [TerminationRequestStatus.APPROVED, TerminationRequestStatus.REJECTED],
    example: TerminationRequestStatus.APPROVED,
  })
  @IsEnum([TerminationRequestStatus.APPROVED, TerminationRequestStatus.REJECTED])
  status: TerminationRequestStatus.APPROVED | TerminationRequestStatus.REJECTED;

  @ApiProperty({
    description: 'Ghi chú khi phản hồi',
    example: 'Tôi đồng ý hủy hợp đồng',
    required: false,
  })
  @IsOptional()
  @IsString()
  responseNote?: string;
}
