import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatMessageDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'c4f2c42b-74c7-484a-893b-7b21546d4e34',
    description: 'ID chatroom',
  })
  chatroomId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7',
    description: 'ID người gửi',
  })
  senderId: string;

  @IsString()
  @ApiProperty({
    example: 'Em sẽ ghé xem phòng vào chiều nay được không ạ?',
    description: 'Nội dung tin nhắn',
  })
  content: string;
}
