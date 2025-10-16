import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';

export enum BookingCondition {
  NOT_APPROVED_YET = 'NOT_APPROVED_YET',
  NOT_APPROVED = 'NOT_APPROVED',
  APPROVED = 'APPROVED',
}

export class FilterBookingDto {
  @IsOptional()
  @IsEnum(BookingCondition)
  @ApiProperty({
    enum: BookingCondition,
    example: BookingCondition.APPROVED,
    description: 'Điều kiện lọc booking',
    required: false,
  })
  condition?: BookingCondition;

  @IsOptional()
  @IsEnum(BookingStatus)
  @ApiProperty({
    enum: BookingStatus,
    example: BookingStatus.PENDING_LANDLORD,
    description: 'Trạng thái lọc booking',
    required: false,
  })
  status?: BookingStatus;
}
