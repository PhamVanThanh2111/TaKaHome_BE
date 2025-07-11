import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chatmessage.entity';
import { CreateChatMessageDto } from './dto/create-chatmessage.dto';
import { UpdateChatMessageDto } from './dto/update-chatmessage.dto';

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  async create(
    createChatMessageDto: CreateChatMessageDto,
  ): Promise<ChatMessage> {
    const msg = this.chatMessageRepository.create(createChatMessageDto as any);
    return this.chatMessageRepository.save(msg);
  }

  async findAll(): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      relations: ['chatroom', 'sender'],
    });
  }

  async findOne(id: number): Promise<ChatMessage> {
    return this.chatMessageRepository.findOne({
      where: { id },
      relations: ['chatroom', 'sender'],
    });
  }

  async update(
    id: number,
    updateChatMessageDto: UpdateChatMessageDto,
  ): Promise<ChatMessage> {
    await this.chatMessageRepository.update(id, updateChatMessageDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.chatMessageRepository.delete(id);
  }
}
