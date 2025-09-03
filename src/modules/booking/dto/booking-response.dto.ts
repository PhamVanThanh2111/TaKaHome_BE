import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';

export class BookingResponseDto {
  @ApiProperty({ example: 'cc7ee48b-dfb6-4890-9612-198dddfac3e1' })
  id: string;

  @ApiProperty({ example: '61b1ebfa-8368-48bb-930f-7b763feffeed' })
  tenantId: string;

  @ApiProperty({ example: 'e2ee5d4a-f409-44c2-91c4-5ea69f405364' })
  propertyId: string;

  @ApiProperty({ example: '2024-07-15' })
  bookingDate: string;

  @ApiProperty({ example: BookingStatus.PENDING_LANDLORD, enum: BookingStatus })
  status: BookingStatus;
}
