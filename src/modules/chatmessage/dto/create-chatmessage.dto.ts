import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatMessageDto {
  @IsNotEmpty()
  chatroomId: string;

  @IsNotEmpty()
  senderId: string;

  @IsString()
  content: string;
}
