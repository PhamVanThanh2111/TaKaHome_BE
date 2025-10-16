/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  Inject,
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
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { Public } from 'src/common/decorators/public.decorator';
import { ConfigType } from '@nestjs/config';
import frontendConfig from '../../config/frontend.config';

interface PaymentState {
  userId: string;
  contractId: string;
  timestamp: number;
}

@Controller('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    @Inject(frontendConfig.KEY)
    private readonly frontend: ConfigType<typeof frontendConfig>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo payment' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PaymentResponseDto,
    description: 'Tạo payment thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress;

    return this.paymentService.createPayment(dto, {
      userId: user.id,
      ipAddr: String(ip),
    });
  }

  @Post('invoice/:invoiceId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo payment từ hóa đơn' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PaymentResponseDto,
    description: 'Tạo payment từ hóa đơn thành công',
  })
  createFromInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { method: 'VNPAY' | 'WALLET' },
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress;

    return this.paymentService.createPaymentFromInvoice(
      invoiceId,
      body.method as any,
      {
        userId: user.id,
        ipAddr: String(ip),
      },
    );
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
    @Query('locale') locale: 'vn',
    @Query('expireIn') expireIn: string,
    @Query('redirect') redirect: string,
    @CurrentUser() user: JwtUser,
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

    const { data } = await this.paymentService.createVnpayPaymentLink({
      contractId,
      amount: amountNum,
      ipAddr: clientIp,
      userId: user.id, // ✅ Add userId for state parameter
      orderInfo,
      locale: locale || 'vn',
      expireIn: expireIn ? Number(expireIn) : undefined,
    });
    if (!data) {
      throw new BadRequestException('Không tạo được link thanh toán VNPay');
    }
    const { paymentUrl, txnRef } = data;

    // redirect ngay nếu được yêu cầu
    if (redirect === '1' || redirect === 'true') {
      return res.redirect(paymentUrl);
    }

    // mặc định trả JSON để FE tự xử lý
    return res.json({ url: paymentUrl, txnRef });
  }

  @Public()
  @Get('vnpay/return')
  async vnpReturn(@Query() q: Record<string, string>, @Res() res: Response) {
    const result = await this.paymentService.verifyVnpayReturn(q);

    const frontendUrl = this.frontend.url;
    const data = result.data;

    if (!data) {
      // Trường hợp lỗi không có data
      return res.redirect(
        `${frontendUrl}/payment-result?status=error&message=Unknown_error`,
      );
    }

    const state = q.state;
    if (state) {
      try {
        const userInfo: PaymentState = JSON.parse(
          Buffer.from(state, 'base64').toString(),
        );

        // Verify payment belongs to the user who initiated it
        const payment = await this.paymentService.findByTxnRef(
          data.txnRef || '',
        );
        if (payment && payment.contract?.tenant?.id !== userInfo.userId) {
          return res.redirect(
            `${frontendUrl}/payment-result?status=error&message=Unauthorized_access`,
          );
        }

        // Verify timestamp (optional: check if state is not too old)
        const stateAge = Date.now() - userInfo.timestamp;
        if (stateAge > 30 * 60 * 1000) {
          // 30 minutes
          return res.redirect(
            `${frontendUrl}/payment-result?status=error&message=State_expired`,
          );
        }

        const params = new URLSearchParams({
          status: data.ok ? 'success' : 'failed',
          code: data.code || '',
          txnRef: data.txnRef || '',
          amount: data.amount?.toString() || '0',
          reason: data.reason || '',
          userId: userInfo.userId, // ✅ Include verified user ID
          contractId: userInfo.contractId, // ✅ Include contract context
          ...(data.bankCode && { bankCode: data.bankCode }),
          ...(data.payDate && { payDate: data.payDate }),
          ...(data.orderInfo && { orderInfo: data.orderInfo }),
        });

        return res.redirect(
          `${frontendUrl}/payment-result?${params.toString()}`,
        );
      } catch (error) {
        console.error('Error verifying state parameter:', error);
        return res.redirect(
          `${frontendUrl}/payment-result?status=error&message=Invalid_state`,
        );
      }
    }

    const params = new URLSearchParams({
      status: data.ok ? 'success' : 'failed',
      code: data.code || '',
      txnRef: data.txnRef || '',
      amount: data.amount?.toString() || '0',
      reason: data.reason || '',
      ...(data.bankCode && { bankCode: data.bankCode }),
      ...(data.payDate && { payDate: data.payDate }),
      ...(data.orderInfo && { orderInfo: data.orderInfo }),
    });

    return res.redirect(`${frontendUrl}/payment-result?${params.toString()}`);
  }

  @Public()
  @Get('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  async vnpIpn(@Query() q: Record<string, string>) {
    const response = await this.paymentService.handleVnpayIpn(q);
    return response.data ?? 'RspCode=99&Message=Unknown error';
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
