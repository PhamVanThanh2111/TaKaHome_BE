import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ContractTerminationRequestService } from './contract-termination-request.service';
import { CreateTerminationRequestDto } from './dto/create-termination-request.dto';
import { RespondTerminationRequestDto } from './dto/respond-termination-request.dto';

@ApiTags('Contract Termination Requests')
@Controller('contracts/termination-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractTerminationRequestController {
  constructor(
    private readonly terminationRequestService: ContractTerminationRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo yêu cầu hủy hợp đồng' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo yêu cầu hủy hợp đồng thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ hoặc vi phạm quy tắc nghiệp vụ',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy hợp đồng',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền tạo yêu cầu hủy cho hợp đồng này',
  })
  createTerminationRequest(
    @Body() dto: CreateTerminationRequestDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.terminationRequestService.createTerminationRequest(
      dto,
      user.id,
    );
  }

  @Patch(':id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Phản hồi yêu cầu hủy hợp đồng (chấp nhận hoặc từ chối)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phản hồi yêu cầu hủy hợp đồng thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Yêu cầu đã được xử lý hoặc không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy yêu cầu hủy hợp đồng',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền phản hồi yêu cầu này',
  })
  respondToTerminationRequest(
    @Param('id') id: string,
    @Body() dto: RespondTerminationRequestDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.terminationRequestService.respondToTerminationRequest(
      id,
      dto,
      user.id,
    );
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy yêu cầu hủy hợp đồng (người tạo yêu cầu)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hủy yêu cầu hủy hợp đồng thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Chỉ có thể hủy yêu cầu đang chờ xử lý',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy yêu cầu hủy hợp đồng',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hủy yêu cầu này',
  })
  cancelTerminationRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.terminationRequestService.cancelTerminationRequest(
      id,
      user.id,
    );
  }

  @Get('my-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách yêu cầu hủy hợp đồng của tôi (tenant hoặc landlord)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách thành công',
  })
  getMyTerminationRequests(@CurrentUser() user: JwtUser) {
    return this.terminationRequestService.getMyTerminationRequests(
      user.id,
    );
  }

  @Get('contract/:contractId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu hủy hợp đồng theo contractId' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách thành công',
  })
  getTerminationRequestsByContract(@Param('contractId') contractId: string, @CurrentUser() user: JwtUser) {
    return this.terminationRequestService.getTerminationRequestsByContract(
      contractId,
      user.id,
    );
  }

  @Get('contract/:contractId/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy yêu cầu hủy hợp đồng đang chờ xử lý của một hợp đồng',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy yêu cầu thành công',
  })
  getPendingTerminationRequest(@Param('contractId') contractId: string, @CurrentUser() user: JwtUser) {
    return this.terminationRequestService.getPendingTerminationRequest(
      contractId,
      user.id,
    );
  }
}
