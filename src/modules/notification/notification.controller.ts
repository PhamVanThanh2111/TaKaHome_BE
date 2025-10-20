import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@Controller('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo notification mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: NotificationResponseDto,
    description: 'Tạo notification thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách notification' })
  @ApiResponse({ status: HttpStatus.OK, type: [NotificationResponseDto] })
  findAll() {
    return this.notificationService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách notification theo userId' })
  @ApiResponse({ status: HttpStatus.OK, type: [NotificationResponseDto] })
  findAllByUserId(@Param('userId') userId: string) {
    return this.notificationService.findAllByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy notification theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: NotificationResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy notification',
  })
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá notification' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá notification thành công',
  })
  remove(@Param('id') id: string) {
    return this.notificationService.remove(id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu notification đã đọc' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: NotificationResponseDto,
    description: 'Đánh dấu notification đã đọc thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy notification',
  })
  markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Patch('user/:userId/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả notification của user đã đọc' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [NotificationResponseDto],
    description: 'Đánh dấu tất cả notification đã đọc thành công',
  })
  markAllAsReadByUserId(@Param('userId') userId: string) {
    return this.notificationService.markAllAsReadByUserId(userId);
  }
}
