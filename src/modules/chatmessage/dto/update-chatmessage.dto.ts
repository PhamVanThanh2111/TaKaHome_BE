import { PartialType } from '@nestjs/mapped-types';
import { CreateChatMessageDto } from './create-chatmessage.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChatMessageDto extends PartialType(CreateChatMessageDto) {
  @ApiPropertyOptional({
    example: '36d44d5f-b9d5-462f-bd35-4fd7e02e37ea',
    description: 'ID message',
  })
  id?: string;
}
