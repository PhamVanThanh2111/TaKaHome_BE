import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
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
}
