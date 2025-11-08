import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('verifications')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Throttle({ verification: {} })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo yêu cầu xác minh giấy tờ' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: VerificationResponseDto,
    description: 'Tạo verification thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createVerificationDto: CreateVerificationDto) {
    return this.verificationService.create(createVerificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách verification' })
  @ApiResponse({ status: HttpStatus.OK, type: [VerificationResponseDto] })
  findAll() {
    return this.verificationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy verification theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: VerificationResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy verification',
  })
  findOne(@Param('id') id: string) {
    return this.verificationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật verification' })
  @ApiResponse({ status: HttpStatus.OK, type: VerificationResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateVerificationDto: UpdateVerificationDto,
  ) {
    return this.verificationService.update(id, updateVerificationDto);
  }
}
