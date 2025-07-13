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
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoleResponseDto } from './dto/role-response.dto';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới role' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: RoleResponseDto,
    description: 'Tạo role thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách role' })
  @ApiResponse({ status: HttpStatus.OK, type: [RoleResponseDto] })
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy role theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: RoleResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy role',
  })
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật role' })
  @ApiResponse({ status: HttpStatus.OK, type: RoleResponseDto })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá role' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá role thành công',
  })
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
