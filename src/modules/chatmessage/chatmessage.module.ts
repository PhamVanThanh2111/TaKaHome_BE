import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chatmessage.entity';
import { ChatMessageService } from './chatmessage.service';
import { ChatMessageController } from './chatmessage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  controllers: [ChatMessageController],
  providers: [ChatMessageService],
  exports: [ChatMessageService, TypeOrmModule],
})
export class ChatMessageModule {}
