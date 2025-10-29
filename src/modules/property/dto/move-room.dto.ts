import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MoveRoomDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd',
    description: 'ID của RoomType đích',
  })
  targetRoomTypeId: string;
}
