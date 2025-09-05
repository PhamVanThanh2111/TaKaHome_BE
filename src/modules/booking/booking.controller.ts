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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingResponseDto } from './dto/booking-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';

@Controller('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo booking mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: BookingResponseDto,
    description: 'Đặt booking thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách booking' })
  @ApiResponse({ status: HttpStatus.OK, type: [BookingResponseDto] })
  findAll() {
    return this.bookingService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy booking theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy booking',
  })
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  // --- Nghiệp vụ flow ---
  @Post(':id/approve')
  @ApiOperation({ summary: 'Chủ nhà duyệt booking' })
  @Roles(RoleEnum.LANDLORD, RoleEnum.ADMIN)
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  approve(@Param('id') id: string) {
    return this.bookingService.landlordApprove(id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Chủ nhà từ chối booking' })
  @Roles(RoleEnum.LANDLORD, RoleEnum.ADMIN)
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  reject(@Param('id') id: string) {
    return this.bookingService.landlordReject(id);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Người thuê ký hợp đồng (digital signature)' })
  @Roles(RoleEnum.TENANT, RoleEnum.ADMIN)
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  tenantSign(@Param('id') id: string) {
    return this.bookingService.tenantSign(id);
  }
}
