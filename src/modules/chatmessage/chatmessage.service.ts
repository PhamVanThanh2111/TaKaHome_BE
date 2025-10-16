import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chatmessage.entity';
import { CreateChatMessageDto } from './dto/create-chatmessage.dto';
import { UpdateChatMessageDto } from './dto/update-chatmessage.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  async create(
    createChatMessageDto: CreateChatMessageDto,
  ): Promise<ResponseCommon<ChatMessage>> {
    const { chatroomId, senderId, content } = createChatMessageDto;
    
    // Create and save the message
    const chatMessage = this.chatMessageRepository.create({
      chatroom: { id: chatroomId },
      sender: { id: senderId },
      content,
    });
    
    const saved = await this.chatMessageRepository.save(chatMessage);
    
    // Load full message with relations for response
    const fullMessage = await this.chatMessageRepository.findOne({
      where: { id: saved.id },
      relations: ['chatroom', 'sender'],
    });
    
    if (!fullMessage) {
      throw new Error('Failed to retrieve saved message');
    }
    
    return new ResponseCommon(201, 'SUCCESS', fullMessage);
  }

  async findAll(): Promise<ResponseCommon<ChatMessage[]>> {
    const messages = await this.chatMessageRepository.find({
      relations: ['chatroom', 'sender'],
    });
    return new ResponseCommon(200, 'SUCCESS', messages);
  }

  // findAllByChatRoomId
  async findAllByChatRoomId(
    chatroomId: string,
  ): Promise<ResponseCommon<ChatMessage[]>> {
    const messages = await this.chatMessageRepository.find({
      where: { chatroom: { id: chatroomId } },
      relations: ['sender'],
    });
    return new ResponseCommon(200, 'SUCCESS', messages);
  }

  async findOne(id: string): Promise<ResponseCommon<ChatMessage | null>> {
    const message = await this.chatMessageRepository.findOne({
      where: { id: id },
      relations: ['chatroom', 'sender'],
    });
    return new ResponseCommon(200, 'SUCCESS', message);
  }

  async update(
    id: string,
    updateChatMessageDto: UpdateChatMessageDto,
  ): Promise<ResponseCommon<ChatMessage>> {
    await this.chatMessageRepository.update(id, updateChatMessageDto);
    const updatedMessage = await this.chatMessageRepository.findOne({
      where: { id },
      relations: ['chatroom', 'sender'],
    });
    if (!updatedMessage) {
      throw new Error(`ChatMessage with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updatedMessage);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.chatMessageRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
