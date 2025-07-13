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
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentResponseDto } from './dto/payment-response.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo payment mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PaymentResponseDto,
    description: 'Tạo payment thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách payment' })
  @ApiResponse({ status: HttpStatus.OK, type: [PaymentResponseDto] })
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy payment theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy payment',
  })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật payment' })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentResponseDto })
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(+id, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá payment' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá payment thành công',
  })
  remove(@Param('id') id: string) {
    return this.paymentService.remove(+id);
  }
}
