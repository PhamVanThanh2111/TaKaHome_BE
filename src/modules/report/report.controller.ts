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
} from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportResponseDto } from './dto/report-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo báo cáo mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ReportResponseDto,
    description: 'Tạo báo cáo thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createReportDto: CreateReportDto) {
    return this.reportService.create(createReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách báo cáo' })
  @ApiResponse({ status: HttpStatus.OK, type: [ReportResponseDto] })
  @Roles('ADMIN')
  findAll() {
    return this.reportService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy báo cáo theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ReportResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy báo cáo',
  })
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật báo cáo' })
  @ApiResponse({ status: HttpStatus.OK, type: ReportResponseDto })
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportService.update(id, updateReportDto);
  }
}
