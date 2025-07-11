import { PartialType } from '@nestjs/mapped-types';
import { CreateChatMessageDto } from './create-chatmessage.dto';

export class UpdateChatMessageDto extends PartialType(CreateChatMessageDto) {}
