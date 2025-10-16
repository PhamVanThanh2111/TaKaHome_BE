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
  Request,
} from '@nestjs/common';
import { ChatRoomService } from './chatroom.service';
import { UpdateChatRoomDto } from './dto/update-chatroom.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatRoomResponseDto } from './dto/chatroom-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';

@Controller('chatrooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.chatRoomService.findAll();
  }

  @Get('my-chats')
  @ApiOperation({ summary: 'Lấy tất cả chats của user hiện tại' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: [ChatRoomResponseDto],
    description: 'Lấy danh sách chat thành công'
  })
  getMyChats(@Request() req: any) {
    const userId = req.user.id;
    return this.chatRoomService.findByCurrentUser(userId);
  }

  @Post('property/:propertyId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Tìm hoặc tạo chat với chủ nhà về một bất động sản',
    description: 'Tự động tạo chatroom giữa user hiện tại và chủ nhà của property. Nếu đã tồn tại thì trả về chatroom đó.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ChatRoomResponseDto,
    description: 'Tạo hoặc tìm thấy chatroom thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bất động sản',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể tạo chat với chính mình hoặc property không có chủ nhà',
  })
  createOrFindByProperty(
    @Param('propertyId') propertyId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    return this.chatRoomService.findOrCreateByProperty(propertyId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chatroom theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy chatroom',
  })
  findOne(@Param('id') id: string) {
    return this.chatRoomService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chatroom' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateChatRoomDto: UpdateChatRoomDto,
  ) {
    return this.chatRoomService.update(id, updateChatRoomDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá chatroom' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá chatroom thành công',
  })
  remove(@Param('id') id: string) {
    return this.chatRoomService.remove(id);
  }
}
