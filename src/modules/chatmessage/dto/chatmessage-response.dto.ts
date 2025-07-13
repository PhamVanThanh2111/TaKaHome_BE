import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageResponseDto {
  @ApiProperty({ example: '36d44d5f-b9d5-462f-bd35-4fd7e02e37ea' })
  id: string;

  @ApiProperty({ example: 'c4f2c42b-74c7-484a-893b-7b21546d4e34' })
  chatroomId: string;

  @ApiProperty({ example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7' })
  senderId: string;

  @ApiProperty({ example: 'Em sẽ ghé xem phòng vào chiều nay được không ạ?' })
  content: string;

  @ApiProperty({
    example: '2024-07-18T08:21:09.000Z',
    description: 'Ngày gửi',
    required: false,
  })
  createdAt?: string;
}
