import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePropertyImageDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'f5b77f44-f276-4cb1-a761-4ccbcfda4453',
    description: 'ID property',
  })
  propertyId: string;

  @IsString()
  @ApiProperty({
    example: 'https://cdn.domain.com/properties/123/image1.jpg',
    description: 'URL hình ảnh',
  })
  imageUrl: string;
}
