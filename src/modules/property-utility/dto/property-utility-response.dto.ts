import { ApiProperty } from '@nestjs/swagger';

export class PropertyUtilityResponseDto {
  @ApiProperty({ example: 'be0fbdac-25b9-46d5-8812-4a6afc3b86c7' })
  id: string;

  @ApiProperty({ example: 'f5b77f44-f276-4cb1-a761-4ccbcfda4453' })
  propertyId: string;

  @ApiProperty({ example: 'Wifi miễn phí' })
  name: string;

  @ApiProperty({
    example: 'Hỗ trợ wifi tốc độ cao trong toàn bộ căn hộ',
    required: false,
  })
  description?: string;
}
