import { ApiPropertyOptional } from '@nestjs/swagger/dist/decorators';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export class UpdateBookingDto {
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
