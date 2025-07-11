import { IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { StatusEnum } from '../../common/enums/status.enum';

export class CreateBookingDto {
  @IsNotEmpty()
  tenantId: string;

  @IsNotEmpty()
  propertyId: string;

  @IsDateString()
  bookingDate: Date;

  @IsEnum(StatusEnum)
  status?: StatusEnum;
}
