import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class RemoveFavoriteDto {
  @IsOptional()
  @ApiProperty({
    example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa',
    description: 'ID property',
  })
  propertyId?: string;

  @IsOptional()
  @ApiProperty({
    example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb',
    description: 'ID room type',
  })
  roomTypeId?: string;
}
