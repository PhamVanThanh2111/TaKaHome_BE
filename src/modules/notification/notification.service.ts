import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { StatusEnum } from '../common/enums/status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<ResponseCommon<Notification>> {
    const { userId, type, title, content, status } = createNotificationDto;
    const notification = this.notificationRepository.create({
      user: { id: userId },
      type,
      title,
      content,
      status: status || StatusEnum.PENDING, // Default to PENDING if not provided
    });
    const saved = await this.notificationRepository.save(notification);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Notification[]>> {
    const notifications = await this.notificationRepository.find({
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', notifications);
  }

  // findAllByUserId
  async findAllByUserId(
    userId: string,
  ): Promise<ResponseCommon<Notification[]>> {
    const notifications = await this.notificationRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', notifications);
  }

  async findOne(id: string): Promise<ResponseCommon<Notification>> {
    const notification = await this.notificationRepository.findOne({
      where: { id: id },
      relations: ['user'],
    });
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', notification);
  }

  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<ResponseCommon<Notification>> {
    await this.notificationRepository.update(id, updateNotificationDto);
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', notification);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.notificationRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
