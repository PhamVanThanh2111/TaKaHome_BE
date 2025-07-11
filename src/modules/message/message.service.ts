import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async create(createMessageDto: CreateMessageDto): Promise<Message> {
    const { senderId, receiverId, propertyId, content } = createMessageDto;

    const message = this.messageRepository.create({
      content,
      sender: { id: senderId },
      receiver: { id: receiverId },
      property: { id: propertyId },
    });

    return this.messageRepository.save(message);
  }

  async findAll(): Promise<Message[]> {
    return this.messageRepository.find({
      relations: ['sender', 'receiver', 'property'],
    });
  }

  async findOne(id: number): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: id.toString() },
      relations: ['sender', 'receiver', 'property'],
    });
  }

  async update(
    id: number,
    updateMessageDto: UpdateMessageDto,
  ): Promise<Message | null> {
    await this.messageRepository.update(id, updateMessageDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.messageRepository.delete(id);
  }
}
