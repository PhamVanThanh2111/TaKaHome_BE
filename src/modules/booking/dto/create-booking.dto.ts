import { IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { StatusEnum } from '../../common/enums/status.enum';

export class CreateBookingDto {
  @IsNotEmpty()
  tenantId: number;

  @IsNotEmpty()
  propertyId: number;

  @IsDateString()
  bookingDate: Date;

  @IsEnum(StatusEnum)
  status?: StatusEnum;
}
