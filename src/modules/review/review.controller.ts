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
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReviewResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@Controller('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo review mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ReviewResponseDto,
    description: 'Tạo review thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.create(createReviewDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách review' })
  @ApiResponse({ status: HttpStatus.OK, type: [ReviewResponseDto] })
  findAll() {
    return this.reviewService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy review theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy review',
  })
  findOne(@Param('id') id: string) {
    return this.reviewService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật review' })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewResponseDto })
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(+id, updateReviewDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá review' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá review thành công',
  })
  remove(@Param('id') id: string) {
    return this.reviewService.remove(+id);
  }
}
