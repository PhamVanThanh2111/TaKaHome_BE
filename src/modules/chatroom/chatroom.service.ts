import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chatroom.entity';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
  ) {}

  async create(
    createChatRoomDto: CreateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoom>> {
    const { user1Id, user2Id } = createChatRoomDto;
    const chatRoom = this.chatRoomRepository.create({
      user1: { id: user1Id },
      user2: { id: user2Id },
    });
    const saved = await this.chatRoomRepository.save(chatRoom);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<ChatRoom[]>> {
    const rooms = await this.chatRoomRepository.find({
      relations: ['user1', 'user2', 'messages'],
    });
    return new ResponseCommon(200, 'SUCCESS', rooms);
  }

  async findOne(id: number): Promise<ResponseCommon<ChatRoom>> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: id.toString() },
      relations: ['user1', 'user2', 'messages'],
    });
    if (!chatRoom) {
      throw new Error(`ChatRoom with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', chatRoom);
  }

  async update(
    id: number,
    updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoom>> {
    await this.chatRoomRepository.update(
      id,
      updateChatRoomDto as Partial<ChatRoom>,
    );
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: id.toString() },
      relations: ['user1', 'user2', 'messages'],
    });
    if (!chatRoom) {
      throw new Error(`ChatRoom with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', chatRoom);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.chatRoomRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
