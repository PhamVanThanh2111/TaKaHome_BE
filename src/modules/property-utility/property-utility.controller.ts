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
import { PropertyUtilityService } from './property-utility.service';
import { CreatePropertyUtilityDto } from './dto/create-property-utility.dto';
import { UpdatePropertyUtilityDto } from './dto/update-property-utility.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PropertyUtilityResponseDto } from './dto/property-utility-response.dto';

@Controller('property-utilities')
export class PropertyUtilityController {
  constructor(
    private readonly propertyUtilityService: PropertyUtilityService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm tiện ích cho property' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PropertyUtilityResponseDto,
    description: 'Thêm tiện ích thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createPropertyUtilityDto: CreatePropertyUtilityDto) {
    return this.propertyUtilityService.create(createPropertyUtilityDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tiện ích property' })
  @ApiResponse({ status: HttpStatus.OK, type: [PropertyUtilityResponseDto] })
  findAll() {
    return this.propertyUtilityService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy tiện ích theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyUtilityResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy tiện ích',
  })
  findOne(@Param('id') id: string) {
    return this.propertyUtilityService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tiện ích' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyUtilityResponseDto })
  update(
    @Param('id') id: string,
    @Body() updatePropertyUtilityDto: UpdatePropertyUtilityDto,
  ) {
    return this.propertyUtilityService.update(+id, updatePropertyUtilityDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá tiện ích' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá tiện ích thành công',
  })
  remove(@Param('id') id: string) {
    return this.propertyUtilityService.remove(+id);
  }
}
