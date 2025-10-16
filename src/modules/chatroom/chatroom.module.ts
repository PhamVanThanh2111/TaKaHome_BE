import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chatroom.entity';
import { ChatRoomService } from './chatroom.service';
import { ChatRoomController } from './chatroom.controller';
import { Property } from '../property/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatRoom, Property])],
  controllers: [ChatRoomController],
  providers: [ChatRoomService],
  exports: [ChatRoomService, TypeOrmModule],
})
export class ChatRoomModule {}
