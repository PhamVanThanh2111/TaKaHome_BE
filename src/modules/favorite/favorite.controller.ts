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
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoriteResponseDto } from './dto/favorite-response.dto';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm property vào yêu thích' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: FavoriteResponseDto,
    description: 'Thêm yêu thích thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoriteService.create(createFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách favorites' })
  @ApiResponse({ status: HttpStatus.OK, type: [FavoriteResponseDto] })
  findAll() {
    return this.favoriteService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy favorite theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy favorite',
  })
  findOne(@Param('id') id: string) {
    return this.favoriteService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật favorite' })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateFavoriteDto: UpdateFavoriteDto,
  ) {
    return this.favoriteService.update(+id, updateFavoriteDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa favorite' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xóa favorite thành công',
  })
  remove(@Param('id') id: string) {
    return this.favoriteService.remove(+id);
  }
}
