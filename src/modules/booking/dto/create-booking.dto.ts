import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @IsOptional()
  @ValidateIf((o: CreateBookingDto) => !o.roomId)
  @IsNotEmpty()
  @ApiProperty({
    example: 'e2ee5d4a-f409-44c2-91c4-5ea69f405364',
    description: 'ID bất động sản (dùng cho HOUSING/APARTMENT)',
    required: false,
  })
  propertyId?: string;

  @IsOptional()
  @ValidateIf((o: CreateBookingDto) => !o.propertyId)
  @IsNotEmpty()
  @ApiProperty({
    example: 'r2ee5d4a-f409-44c2-91c4-5ea69f405364',
    description: 'ID phòng (dùng cho BOARDING)',
    required: false,
  })
  roomId?: string;
}
