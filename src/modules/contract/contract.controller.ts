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
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContractResponseDto } from './dto/contract-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';

@Controller('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo hợp đồng mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ContractResponseDto,
    description: 'Tạo hợp đồng thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractService.create(createContractDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: [ContractResponseDto] })
  @Roles('ADMIN')
  findAll() {
    return this.contractService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy hợp đồng theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy hợp đồng',
  })
  findOne(@Param('id') id: string) {
    return this.contractService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    return this.contractService.update(id, updateContractDto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Kích hoạt hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @Roles('ADMIN')
  activate(@Param('id') id: string) {
    return this.contractService.activate(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Hoàn thành hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @Roles('ADMIN')
  complete(@Param('id') id: string) {
    return this.contractService.complete(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @Roles('ADMIN')
  cancel(@Param('id') id: string) {
    return this.contractService.cancel(id);
  }

  @Patch(':id/terminate')
  @ApiOperation({ summary: 'Chấm dứt hợp đồng' })
  @ApiResponse({ status: HttpStatus.OK, type: ContractResponseDto })
  @Roles('ADMIN')
  terminate(@Param('id') id: string) {
    return this.contractService.terminate(id);
  }

  @Get(':id/file-url')
  @ApiOperation({ summary: 'Lấy URL truy cập file hợp đồng' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trả về presigned URL để truy cập file hợp đồng',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'SUCCESS' },
        data: {
          type: 'object',
          properties: {
            fileUrl: { type: 'string', example: 'https://presigned-url...' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy hợp đồng',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập hợp đồng này',
  })
  getContractFileUrl(
    @Param('id') contractId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractService.getContractFileUrl(contractId, user.id);
  }
}
