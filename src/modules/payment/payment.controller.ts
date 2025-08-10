import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Request, Response } from 'express';

@Controller('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN')
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

  @Get('vnpay/create')
  async createVnpay(
    @Query('contractId') contractId: string,
    @Query('amount') amount: string,
    @Query('orderInfo') orderInfo: string,
    @Query('locale') locale: 'vn' | 'en' = 'vn',
    @Query('expireIn') expireIn: string,
    @Query('redirect') redirect: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const amountNum = Number(amount);
    if (!contractId || !amount || Number.isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException(
        'contractId và amount (VND) là bắt buộc và phải hợp lệ',
      );
    }
    const clientIp = this.getClientIpIPv4(req);
    console.log('Client IP:', clientIp);

    const { paymentUrl, txnRef } =
      await this.paymentService.createVnpayPaymentLink({
        contractId,
        amount: amountNum,
        ipAddr: clientIp,
        orderInfo,
        locale: locale || 'vn',
        expireIn: expireIn ? Number(expireIn) : undefined,
      });

    // redirect ngay nếu được yêu cầu
    if (redirect === '1' || redirect === 'true') {
      return res.redirect(paymentUrl);
    }

    // mặc định trả JSON để FE tự xử lý
    return res.json({ url: paymentUrl, txnRef });
  }

  /** Helper: lấy IP thật của client (hữu ích khi chạy sau reverse proxy) */
  private getClientIpIPv4(req: Request) {
    let ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '';

    // Xử lý các dạng hay gặp khi chạy local/proxy
    if (ip.startsWith('::ffff:')) ip = ip.substring(7); // ::ffff:127.0.0.1
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') ip = '127.0.0.1';
    // Trường hợp có port: 192.168.1.10:5050
    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(':')[0];
    // Nếu vẫn không phải IPv4, fallback 127.0.0.1
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ip = '127.0.0.1';

    return ip;
  }
}
