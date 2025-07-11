import { IsNotEmpty } from 'class-validator';

export class CreateChatRoomDto {
  @IsNotEmpty()
  user1Id: string;

  @IsNotEmpty()
  user2Id: string;
}
