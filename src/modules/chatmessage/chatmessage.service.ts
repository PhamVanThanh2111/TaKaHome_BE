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
    const { chatroomId, senderId, content } = createChatMessageDto;
    const chatMessage = this.chatMessageRepository.create({
      chatroom: { id: chatroomId },
      sender: { id: senderId },
      content,
    });
    return this.chatMessageRepository.save(chatMessage);
  }

  async findAll(): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      relations: ['chatroom', 'sender'],
    });
  }

  // findAllByChatRoomId
  async findAllByChatRoomId(chatroomId: string): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { chatroom: { id: chatroomId } },
      relations: ['sender'],
    });
  }

  async findOne(id: string): Promise<ChatMessage | null> {
    return this.chatMessageRepository.findOne({
      where: { id: id },
      relations: ['chatroom', 'sender'],
    });
  }

  async update(
    id: string,
    updateChatMessageDto: UpdateChatMessageDto,
  ): Promise<ChatMessage> {
    await this.chatMessageRepository.update(id, updateChatMessageDto);
    const updatedMessage = await this.findOne(id);
    if (!updatedMessage) {
      throw new Error(`ChatMessage with id ${id} not found`);
    }
    return updatedMessage;
  }

  async remove(id: string): Promise<void> {
    await this.chatMessageRepository.delete(id);
  }
}
