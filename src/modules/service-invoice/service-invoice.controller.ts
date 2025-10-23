import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam, ApiBody } from '@nestjs/swagger';
import { ServiceInvoiceService } from './service-invoice.service';
import { CreateServiceInvoiceDto } from './dto/create-service-invoice.dto';
import { UpdateServiceInvoiceDto } from './dto/update-service-invoice.dto';
import { ProcessInvoiceResponseDto } from './dto/process-invoice.dto';

@ApiTags('service-invoices')
@Controller('service-invoices')
export class ServiceInvoiceController {
  constructor(private readonly serviceInvoiceService: ServiceInvoiceService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo hóa đơn dịch vụ mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  create(@Body() createServiceInvoiceDto: CreateServiceInvoiceDto) {
    return this.serviceInvoiceService.create(createServiceInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  findAll() {
    return this.serviceInvoiceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin hóa đơn dịch vụ theo ID' })
  @ApiParam({ name: 'id', description: 'ID của hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceInvoiceService.findOne(id);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn dịch vụ theo hợp đồng' })
  @ApiParam({ name: 'contractId', description: 'ID của hợp đồng' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  findByContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.serviceInvoiceService.findByContract(contractId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hóa đơn dịch vụ' })
  @ApiParam({ name: 'id', description: 'ID của hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceInvoiceDto: UpdateServiceInvoiceDto,
  ) {
    return this.serviceInvoiceService.update(id, updateServiceInvoiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa hóa đơn dịch vụ' })
  @ApiParam({ name: 'id', description: 'ID của hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceInvoiceService.remove(id);
  }

  @Post('process-invoice')
  @ApiOperation({ 
    summary: 'Xử lý hình ảnh hóa đơn bằng Google Document AI',
    description: 'Upload hình ảnh hóa đơn để trích xuất thông tin tự động'
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 200, 
    description: 'Xử lý thành công',
    type: ProcessInvoiceResponseDto
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
  async processInvoice(@UploadedFile() file: Express.Multer.File): Promise<ProcessInvoiceResponseDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng upload file hình ảnh hóa đơn');
    }

    // Kiểm tra định dạng file
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ file ảnh (JPEG, PNG) hoặc PDF');
    }

    // Kiểm tra kích thước file (tối đa 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Kích thước file không được vượt quá 10MB');
    }

    return await this.serviceInvoiceService.processInvoiceImage(file.buffer, file.mimetype);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Đánh dấu hóa đơn dịch vụ đã thanh toán' })
  @ApiParam({ name: 'id', description: 'ID của hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  markAsPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceInvoiceService.markAsPaid(id);
  }

  @Patch(':id/mark-overdue')
  @ApiOperation({ summary: 'Đánh dấu hóa đơn dịch vụ quá hạn' })
  @ApiParam({ name: 'id', description: 'ID của hóa đơn dịch vụ' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  markAsOverdue(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceInvoiceService.markAsOverdue(id);
  }
}