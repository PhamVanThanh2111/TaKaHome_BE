import { PartialType } from '@nestjs/mapped-types';
import { CreateMessageDto } from './create-message.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMessageDto extends PartialType(CreateMessageDto) {
  @ApiPropertyOptional({
    example: 'b432ef6e-12e9-415d-acc8-5cb3c3cc285b',
    description: 'ID message',
  })
  id?: string;
}
