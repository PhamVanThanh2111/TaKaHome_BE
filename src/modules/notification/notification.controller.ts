import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationResponseDto } from './dto/notification-response.dto';

@Controller('notifications')
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

  @Get(':id')
  @ApiOperation({ summary: 'Lấy notification theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: NotificationResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy notification',
  })
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật notification' })
  @ApiResponse({ status: HttpStatus.OK, type: NotificationResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(+id, updateNotificationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá notification' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá notification thành công',
  })
  remove(@Param('id') id: string) {
    return this.notificationService.remove(+id);
  }
}
