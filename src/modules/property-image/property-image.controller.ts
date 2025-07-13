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
import { PropertyImageService } from './property-image.service';
import { CreatePropertyImageDto } from './dto/create-property-image.dto';
import { UpdatePropertyImageDto } from './dto/update-property-image.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PropertyImageResponseDto } from './dto/property-image-response.dto';

@Controller('property-images')
export class PropertyImageController {
  constructor(private readonly propertyImageService: PropertyImageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm ảnh cho property' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PropertyImageResponseDto,
    description: 'Thêm ảnh thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createPropertyImageDto: CreatePropertyImageDto) {
    return this.propertyImageService.create(createPropertyImageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách ảnh property' })
  @ApiResponse({ status: HttpStatus.OK, type: [PropertyImageResponseDto] })
  findAll() {
    return this.propertyImageService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy ảnh theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyImageResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy ảnh',
  })
  findOne(@Param('id') id: string) {
    return this.propertyImageService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật ảnh' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyImageResponseDto })
  update(
    @Param('id') id: string,
    @Body() updatePropertyImageDto: UpdatePropertyImageDto,
  ) {
    return this.propertyImageService.update(+id, updatePropertyImageDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá ảnh property' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá ảnh thành công',
  })
  remove(@Param('id') id: string) {
    return this.propertyImageService.remove(+id);
  }
}
