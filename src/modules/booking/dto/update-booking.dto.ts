import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { ApiPropertyOptional } from '@nestjs/swagger/dist/decorators';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @ApiPropertyOptional({
    example: 'cc7ee48b-dfb6-4890-9612-198dddfac3e1',
    description: 'ID Booking',
  })
  id?: string;

  @ApiPropertyOptional({
    example: BookingStatus.PENDING_LANDLORD,
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsDateString()
  escrowDepositDueAt?: string;

  @IsOptional()
  @IsDateString()
  firstRentDueAt?: string;
}
