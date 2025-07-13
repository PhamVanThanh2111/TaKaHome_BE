import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateChatRoomDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7',
    description: 'ID user 1',
  })
  user1Id: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '6ac6a4d0-cc98-4ad6-812b-cacdb56b64c1',
    description: 'ID user 2',
  })
  user2Id: string;
}
