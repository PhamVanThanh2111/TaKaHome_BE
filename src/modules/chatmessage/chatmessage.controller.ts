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
  UseGuards,
} from '@nestjs/common';
import { ChatMessageService } from './chatmessage.service';
import { CreateChatMessageDto } from './dto/create-chatmessage.dto';
import { UpdateChatMessageDto } from './dto/update-chatmessage.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatMessageResponseDto } from './dto/chatmessage-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@Controller('chatmessages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ChatMessageController {
  constructor(private readonly chatMessageService: ChatMessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi message mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ChatMessageResponseDto,
    description: 'Gửi message thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createChatMessageDto: CreateChatMessageDto) {
    return this.chatMessageService.create(createChatMessageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách message' })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatMessageResponseDto] })
  findAll() {
    return this.chatMessageService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy message theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatMessageResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy message',
  })
  findOne(@Param('id') id: string) {
    return this.chatMessageService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật message' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatMessageResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateChatMessageDto: UpdateChatMessageDto,
  ) {
    return this.chatMessageService.update(+id, updateChatMessageDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá message' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá message thành công',
  })
  remove(@Param('id') id: string) {
    return this.chatMessageService.remove(+id);
  }
}
