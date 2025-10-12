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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingResponseDto } from './dto/booking-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';

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
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.bookingService.create(createBookingDto, user.id);
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
  approve(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.bookingService.landlordApprove(id, user.id);
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
  tenantSign(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.bookingService.tenantSign(id, user.id);
  }

  @Post(':id/handover')
  @ApiOperation({ summary: 'Chủ nhà bàn giao tài sản' })
  @Roles(RoleEnum.LANDLORD, RoleEnum.ADMIN)
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  handover(@Param('id') id: string) {
    return this.bookingService.handover(id);
  }

  @Post(':id/settlement/start')
  @ApiOperation({
    summary:
      'Bắt đầu tranh chấp (Dispute) - Người thuê không đồng ý với Báo cáo hư hại',
  })
  @Roles(RoleEnum.TENANT, RoleEnum.ADMIN)
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  startSettlement(@Param('id') id: string) {
    return this.bookingService.startSettlement(id);
  }

  @Post(':id/settlement/close')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Kết thúc tranh chấp (Dispute) - Admin quyết định' })
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  closeSettled(@Param('id') id: string) {
    return this.bookingService.closeSettled(id);
  }

  // Cập nhật mốc thời gian/hạn (nếu cần chỉnh tay)
  @Patch(':id')
  @Roles(RoleEnum.ADMIN, RoleEnum.LANDLORD)
  @ApiOperation({ summary: 'Cập nhật thông tin booking' })
  @ApiResponse({ status: HttpStatus.OK, type: BookingResponseDto })
  updateMeta(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingService.updateMeta(id, dto);
  }
}
