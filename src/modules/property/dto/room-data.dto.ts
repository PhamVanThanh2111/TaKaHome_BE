import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class RoomDataDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'A101',
    description: 'Tên phòng',
  })
  name: string;

  @IsNumber()
  @ApiProperty({
    example: 1,
    description: 'Số tầng',
  })
  floor: number;
}
