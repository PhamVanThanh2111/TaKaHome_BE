import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { RemoveFavoriteDto } from './dto/remove-favorite.dto';

@Controller('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  create(@Body() createFavoriteDto: CreateFavoriteDto, @CurrentUser() user: JwtUser) {
    return this.favoriteService.create(createFavoriteDto, user.id);
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
    return this.favoriteService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa favorite' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa favorite thành công',
  })
  remove(@Body() removeFavoriteDto: RemoveFavoriteDto, @CurrentUser() user: JwtUser) {
    return this.favoriteService.remove(removeFavoriteDto, user.id);
  }
}
