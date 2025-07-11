import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chatroom.entity';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
  ) {}

  async create(createChatRoomDto: CreateChatRoomDto): Promise<ChatRoom> {
    const room = this.chatRoomRepository.create(createChatRoomDto as any);
    return this.chatRoomRepository.save(room);
  }

  async findAll(): Promise<ChatRoom[]> {
    return this.chatRoomRepository.find({
      relations: ['user1', 'user2', 'messages'],
    });
  }

  async findOne(id: number): Promise<ChatRoom> {
    return this.chatRoomRepository.findOne({
      where: { id },
      relations: ['user1', 'user2', 'messages'],
    });
  }

  async update(
    id: number,
    updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ChatRoom> {
    await this.chatRoomRepository.update(id, updateChatRoomDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.chatRoomRepository.delete(id);
  }
}
