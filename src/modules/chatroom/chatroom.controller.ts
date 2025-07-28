import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ChatRoomService } from './chatroom.service';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatRoomResponseDto } from './dto/chatroom-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('chatrooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách chatroom' })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatRoomResponseDto] })
  @Roles('ADMIN')
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
