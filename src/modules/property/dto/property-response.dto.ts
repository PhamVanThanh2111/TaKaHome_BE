import { ApiProperty } from '@nestjs/swagger';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';

export class PropertyResponseDto {
  @ApiProperty({ example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd' })
  id: string;

  @ApiProperty({ example: 'Căn hộ Masteri' })
  title: string;

  @ApiProperty({ example: 'Căn hộ 2PN view sông, đầy đủ tiện nghi' })
  description: string;

  @ApiProperty({ example: '123 Lê Lợi, Quận 1, TP.HCM' })
  address: string;

  @ApiProperty({ example: PropertyTypeEnum.APARTMENT, enum: PropertyTypeEnum })
  type: PropertyTypeEnum;

  @ApiProperty({ example: 12000000 })
  price: number;

  @ApiProperty({ example: 80, required: false })
  area?: number;

  @ApiProperty({ example: 2, required: false })
  bedrooms?: number;

  @ApiProperty({ example: 2, required: false })
  bathrooms?: number;

  @ApiProperty({ example: '10.7769,106.7009', required: false })
  mapLocation?: string;

  @ApiProperty({ example: '6a36daba-79e1-4de8-8db5-281d8f6a81c1' })
  landlordId: string;

  @ApiProperty({ example: true })
  isVisible: boolean;
}
