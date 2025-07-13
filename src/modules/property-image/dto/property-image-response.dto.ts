import { ApiProperty } from '@nestjs/swagger';

export class PropertyImageResponseDto {
  @ApiProperty({ example: 'b8ef15c7-9db1-4b9f-8c44-420b4b9e9877' })
  id: string;

  @ApiProperty({ example: 'f5b77f44-f276-4cb1-a761-4ccbcfda4453' })
  propertyId: string;

  @ApiProperty({ example: 'https://cdn.domain.com/properties/123/image1.jpg' })
  imageUrl: string;
}
