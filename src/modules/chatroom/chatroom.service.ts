import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chatroom.entity';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Property } from '../property/entities/property.entity';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
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
      relations: ['user1', 'user2', 'property', 'messages'],
    });
    return new ResponseCommon(200, 'SUCCESS', rooms);
  }

  async findOne(id: string): Promise<ResponseCommon<ChatRoom>> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: id },
      relations: ['user1', 'user2', 'property', 'messages'],
    });
    if (!chatRoom) {
      throw new NotFoundException(`ChatRoom with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', chatRoom);
  }

  async update(
    id: string,
    updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoom>> {
    await this.chatRoomRepository.update(
      id,
      updateChatRoomDto as Partial<ChatRoom>,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.chatRoomRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }

  /**
   * Tìm hoặc tạo chatroom giữa user hiện tại và chủ nhà của property
   */
  async findOrCreateByProperty(
    propertyId: string,
    currentUserId: string,
  ): Promise<ResponseCommon<ChatRoom>> {
    // 1. Tìm property và validate
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
      relations: ['landlord'],
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} not found`);
    }

    if (!property.landlord) {
      throw new BadRequestException('Property does not have a landlord assigned');
    }

    const landlordId = property.landlord.id;

    // Không cho phép chat với chính mình
    if (currentUserId === landlordId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    // 2. Tìm chatroom đã tồn tại
    const existingRoom = await this.chatRoomRepository.findOne({
      where: [
        {
          user1: { id: currentUserId },
          user2: { id: landlordId },
          property: { id: propertyId },
        },
        {
          user1: { id: landlordId },
          user2: { id: currentUserId },
          property: { id: propertyId },
        },
      ],
      relations: ['user1', 'user2', 'property', 'messages'],
    });

    if (existingRoom) {
      return new ResponseCommon(200, 'SUCCESS', existingRoom);
    }

    // 3. Tạo chatroom mới
    const newChatRoom = this.chatRoomRepository.create({
      user1: { id: currentUserId },
      user2: { id: landlordId },
      property: { id: propertyId },
    });

    const savedRoom = await this.chatRoomRepository.save(newChatRoom);
    
    // Load đầy đủ thông tin để trả về
    const fullRoom = await this.chatRoomRepository.findOne({
      where: { id: savedRoom.id },
      relations: ['user1', 'user2', 'property', 'messages'],
    });

    if (!fullRoom) {
      throw new BadRequestException('Failed to retrieve created chat room');
    }

    return new ResponseCommon(201, 'CREATED', fullRoom);
  }

  /**
   * Lấy tất cả chatrooms của user hiện tại
   */
  async findByCurrentUser(userId: string): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [
        { user1: { id: userId } },
        { user2: { id: userId } },
      ],
      relations: ['user1', 'user2', 'property', 'messages'],
      order: { updatedAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }

  /**
   * Tìm chatroom giữa 2 users cụ thể
   */
  async findBetweenUsers(
    user1Id: string,
    user2Id: string,
  ): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [
        { user1: { id: user1Id }, user2: { id: user2Id } },
        { user1: { id: user2Id }, user2: { id: user1Id } },
      ],
      relations: ['user1', 'user2', 'property', 'messages'],
      order: { updatedAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }
}
