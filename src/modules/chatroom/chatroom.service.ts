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
    const { user1Id, user2Id } = createChatRoomDto;
    const chatRoom = this.chatRoomRepository.create({
      user1: { id: user1Id },
      user2: { id: user2Id },
    });
    return this.chatRoomRepository.save(chatRoom);
  }

  async findAll(): Promise<ChatRoom[]> {
    return this.chatRoomRepository.find({
      relations: ['user1', 'user2', 'messages'],
    });
  }

  async findOne(id: number): Promise<ChatRoom> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: id.toString() },
      relations: ['user1', 'user2', 'messages'],
    });
    if (!chatRoom) {
      throw new Error(`ChatRoom with id ${id} not found`);
    }
    return chatRoom;
  }

  async update(
    id: number,
    updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ChatRoom> {
    await this.chatRoomRepository.update(
      id,
      updateChatRoomDto as Partial<ChatRoom>,
    );
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.chatRoomRepository.delete(id);
  }
}
