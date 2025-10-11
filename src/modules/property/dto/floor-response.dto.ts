import { ApiProperty } from '@nestjs/swagger';

export class FloorResponseDto {
  @ApiProperty({ example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd' })
  id: string;

  @ApiProperty({ example: 'Tầng trệt' })
  name: string;

  @ApiProperty({ example: ['A101', 'A102', 'A103', 'A104'] })
  rooms: string[];

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-10-07T10:00:00Z' })
  updatedAt: Date;
}
