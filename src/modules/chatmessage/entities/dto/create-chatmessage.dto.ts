import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatMessageDto {
  @IsNotEmpty()
  chatroomId: number;

  @IsNotEmpty()
  senderId: number;

  @IsString()
  content: string;
}
