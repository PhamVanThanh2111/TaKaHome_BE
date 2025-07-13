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
import { ChatRoomService } from './chatroom.service';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatRoomResponseDto } from './dto/chatroom-response.dto';

@Controller('chatrooms')
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo chatroom mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ChatRoomResponseDto,
    description: 'Tạo chatroom thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createChatRoomDto: CreateChatRoomDto) {
    return this.chatRoomService.create(createChatRoomDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách chatroom' })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatRoomResponseDto] })
  findAll() {
    return this.chatRoomService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chatroom theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy chatroom',
  })
  findOne(@Param('id') id: string) {
    return this.chatRoomService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chatroom' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateChatRoomDto: UpdateChatRoomDto,
  ) {
    return this.chatRoomService.update(+id, updateChatRoomDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá chatroom' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá chatroom thành công',
  })
  remove(@Param('id') id: string) {
    return this.chatRoomService.remove(+id);
  }
}
