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
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MessageResponseDto } from './dto/message-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@Controller('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi tin nhắn mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: MessageResponseDto,
    description: 'Gửi tin nhắn thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messageService.create(createMessageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn' })
  @ApiResponse({ status: HttpStatus.OK, type: [MessageResponseDto] })
  findAll() {
    return this.messageService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy tin nhắn theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: MessageResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy tin nhắn',
  })
  findOne(@Param('id') id: string) {
    return this.messageService.findOne(+id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá tin nhắn' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá tin nhắn thành công',
  })
  remove(@Param('id') id: string) {
    return this.messageService.remove(+id);
  }
}
