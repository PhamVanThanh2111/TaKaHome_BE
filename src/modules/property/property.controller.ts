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
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PropertyResponseDto } from './dto/property-response.dto';

@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bất động sản mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PropertyResponseDto,
    description: 'Tạo bất động sản thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertyService.create(createPropertyDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bất động sản' })
  @ApiResponse({ status: HttpStatus.OK, type: [PropertyResponseDto] })
  findAll() {
    return this.propertyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin bất động sản theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bất động sản',
  })
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin bất động sản' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyResponseDto })
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertyService.update(+id, updatePropertyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa bất động sản' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xóa bất động sản thành công',
  })
  remove(@Param('id') id: string) {
    return this.propertyService.remove(+id);
  }
}
