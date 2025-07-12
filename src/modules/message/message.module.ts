import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService, TypeOrmModule],
})
export class MessageModule {}
