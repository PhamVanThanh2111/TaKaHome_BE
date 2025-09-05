import { IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '61b1ebfa-8368-48bb-930f-7b763feffeed',
    description: 'ID người thuê (tenant)',
  })
  tenantId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'e2ee5d4a-f409-44c2-91c4-5ea69f405364',
    description: 'ID bất động sản',
  })
  propertyId: string;

  @IsOptional()
  @IsDateString()
  firstRentDueAt?: string;
}
