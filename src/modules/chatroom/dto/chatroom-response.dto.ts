import { ApiProperty } from '@nestjs/swagger';

export class ChatRoomResponseDto {
  @ApiProperty({ example: '73b3987b-f8bb-4282-9c32-11b48f5e9633' })
  id: string;

  @ApiProperty({ example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7' })
  user1Id: string;

  @ApiProperty({ example: '6ac6a4d0-cc98-4ad6-812b-cacdb56b64c1' })
  user2Id: string;
}
