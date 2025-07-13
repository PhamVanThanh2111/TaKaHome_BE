import { PartialType } from '@nestjs/mapped-types';
import { CreateChatRoomDto } from './create-chatroom.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChatRoomDto extends PartialType(CreateChatRoomDto) {
  @ApiPropertyOptional({
    example: '73b3987b-f8bb-4282-9c32-11b48f5e9633',
    description: 'ID chatroom',
  })
  id?: string;
}
