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
import { AdminActionService } from './admin-action.service';
import { CreateAdminActionDto } from './dto/create-admin-action.dto';
import { UpdateAdminActionDto } from './dto/update-admin-action.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminActionResponseDto } from './dto/admin-action-response.dto';

@Controller('admin-actions')
export class AdminActionController {
  constructor(private readonly adminActionService: AdminActionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo admin action mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: AdminActionResponseDto,
    description: 'Tạo admin action thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createAdminActionDto: CreateAdminActionDto) {
    return this.adminActionService.create(createAdminActionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách admin action' })
  @ApiResponse({ status: HttpStatus.OK, type: [AdminActionResponseDto] })
  findAll() {
    return this.adminActionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy admin action theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminActionResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy admin action',
  })
  findOne(@Param('id') id: string) {
    return this.adminActionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật admin action' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminActionResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateAdminActionDto: UpdateAdminActionDto,
  ) {
    return this.adminActionService.update(id, updateAdminActionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá admin action' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá admin action thành công',
  })
  remove(@Param('id') id: string) {
    return this.adminActionService.remove(id);
  }
}
