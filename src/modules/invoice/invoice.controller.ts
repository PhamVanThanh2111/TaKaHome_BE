import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceService } from './invoice.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateUtilityBillDto } from './dto/create-utility-bill.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { ProcessInvoiceResponseDto } from './invoice.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Controller('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles('LANDLORD', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo hóa đơn' })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvoiceResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn' })
  @ApiResponse({ status: HttpStatus.OK, type: [InvoiceResponseDto] })
  @Roles('ADMIN')
  findAll() {
    return this.invoiceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy hóa đơn theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: InvoiceResponseDto })
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lấy hóa đơn theo hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: [InvoiceResponseDto] })
  findByContract(@Param('contractId') contractId: string) {
    return this.invoiceService.findByContract(contractId);
  }

  @Get('pending/user/:userId')
  @ApiOperation({ summary: 'Lấy hóa đơn chưa thanh toán của user' })
  @ApiResponse({ status: HttpStatus.OK, type: [InvoiceResponseDto] })
  findPendingByUser(@Param('userId') userId: string) {
    return this.invoiceService.findPendingByUser(userId);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Thanh toán hóa đơn' })
  @ApiResponse({ status: HttpStatus.OK, type: InvoiceResponseDto })
  markPaid(@Param('id') id: string) {
    return this.invoiceService.markPaid(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy hóa đơn' })
  @ApiResponse({ status: HttpStatus.OK, type: InvoiceResponseDto })
  cancel(@Param('id') id: string) {
    return this.invoiceService.cancel(id);
  }

  @Post('utility-bill')
  @Roles('LANDLORD', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo hóa đơn dịch vụ cho phòng trọ',
    description:
      'Tạo hóa đơn cho các dịch vụ như điện, nước, bảo vệ, gửi xe, internet, vệ sinh. Có thể tạo một hoặc nhiều dịch vụ trong cùng một hóa đơn.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvoiceResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Dữ liệu không hợp lệ hoặc dịch vụ đã tồn tại trong kỳ billing',
  })
  createUtilityBill(@Body() dto: CreateUtilityBillDto) {
    return this.invoiceService.createUtilityBill(dto);
  }

  @Post('process-invoice')
  @ApiOperation({
    summary: 'Xử lý hình ảnh hóa đơn bằng Google Document AI',
    description: 'Upload hình ảnh hóa đơn để trích xuất thông tin tự động',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Xử lý thành công',
    type: ResponseCommon<ProcessInvoiceResponseDto>,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @UseInterceptors(FileInterceptor('invoice'))
  @ApiBody({
    description: 'Hình ảnh hóa đơn (JPEG, PNG, PDF)',
    schema: {
      type: 'object',
      properties: {
        invoice: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async processInvoice(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ResponseCommon<ProcessInvoiceResponseDto>> {
    if (!file) {
      throw new BadRequestException('Vui lòng upload file hình ảnh hóa đơn');
    }

    // Kiểm tra định dạng file
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ file ảnh (JPEG, PNG) hoặc PDF');
    }

    // Kiểm tra kích thước file (tối đa 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Kích thước file không được vượt quá 10MB');
    }

    return await this.invoiceService.processInvoiceImage(
      file.buffer,
      file.mimetype,
    );
  }
}
