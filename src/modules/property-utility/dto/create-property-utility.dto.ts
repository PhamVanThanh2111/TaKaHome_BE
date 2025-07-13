import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePropertyUtilityDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'f5b77f44-f276-4cb1-a761-4ccbcfda4453',
    description: 'ID property',
  })
  propertyId: string;

  @IsString()
  @ApiProperty({ example: 'Wifi miễn phí', description: 'Tên tiện ích' })
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Hỗ trợ wifi tốc độ cao trong toàn bộ căn hộ',
    required: false,
    description: 'Mô tả tiện ích',
  })
  description?: string;
}
