import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateFavoriteDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32',
    description: 'ID user',
  })
  userId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa',
    description: 'ID property',
  })
  propertyId: string;
}
