import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  senderId: number;

  @IsNotEmpty()
  receiverId: number;

  @IsNotEmpty()
  propertyId: number;

  @IsString()
  content: string;
}
