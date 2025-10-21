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
import { ContractExtensionService } from './contract-extension.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { CreateContractExtensionDto } from './dto/create-contract-extension.dto';
import { RespondContractExtensionDto } from './dto/respond-contract-extension.dto';
import { TenantRespondExtensionDto } from './dto/tenant-respond-extension.dto';
import { GetContractExtensionsDto } from './dto/get-contract-extensions.dto';
import { ContractExtensionResponseDto } from './dto/contract-extension-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContractResponseDto } from './dto/contract-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { RoleEnum } from '../common/enums/role.enum';

@Controller('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly contractExtensionService: ContractExtensionService,
  ) {}

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

  // Contract Extension Endpoints
  @Post('extensions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yêu cầu gia hạn hợp đồng (Tenant)' })
  @Roles(RoleEnum.TENANT)
  requestExtension(
    @Body() dto: CreateContractExtensionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.requestExtension(dto, user.id);
  }

  @Patch('extensions/:id/respond')
  @ApiOperation({ summary: 'Phản hồi yêu cầu gia hạn (Landlord)' })
  @Roles(RoleEnum.LANDLORD)
  respondToExtension(
    @Param('id') extensionId: string,
    @Body() dto: RespondContractExtensionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.respondToExtension(
      extensionId,
      dto,
      user.id,
    );
  }

  @Patch('extensions/:id/tenant-respond')
  @ApiOperation({ summary: 'Tenant đồng ý hoặc từ chối giá mới' })
  @Roles(RoleEnum.TENANT)
  tenantRespondToExtension(
    @Param('id') extensionId: string,
    @Body() dto: TenantRespondExtensionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.tenantRespondToExtension(
      extensionId,
      dto,
      user.id,
    );
  }

  @Get(':id/extensions')
  @ApiOperation({ summary: 'Lấy danh sách gia hạn của hợp đồng' })
  getContractExtensions(
    @Param('id') contractId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.getContractExtensions(
      contractId,
      user.id,
    );
  }

  @Patch('extensions/:id/cancel')
  @ApiOperation({ summary: 'Hủy yêu cầu gia hạn (Tenant)' })
  @Roles(RoleEnum.TENANT)
  cancelExtension(
    @Param('id') extensionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.cancelExtension(extensionId, user.id);
  }

  // Extension Signing Endpoints
  @Patch('extensions/:id/landlord-sign')
  @ApiOperation({ summary: 'Chủ nhà ký hợp đồng gia hạn' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ký thành công' })
  @Roles(RoleEnum.LANDLORD)
  landlordSignExtension(
    @Param('id') extensionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.landlordSignExtension(
      extensionId,
      user.id,
    );
  }

  @Patch('extensions/:id/tenant-sign')
  @ApiOperation({ summary: 'Người thuê ký hợp đồng gia hạn' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ký thành công' })
  @Roles(RoleEnum.TENANT)
  tenantSignExtension(
    @Param('id') extensionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.tenantSignExtension(
      extensionId,
      user.id,
    );
  }

  @Post('extensions/list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Lấy danh sách contract extensions theo contractId',
    description: 'API này cho phép lấy danh sách tất cả các yêu cầu gia hạn của một hợp đồng. Người dùng phải là TENANT hoặc LANDLORD của hợp đồng đó.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách contract extensions được trả về thành công',
    type: [ContractExtensionResponseDto],
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Contract extensions retrieved successfully' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ContractExtensionResponseDto' }
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy contract',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập - chỉ tenant hoặc landlord mới có thể xem',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ',
  })
  getContractExtensionsList(
    @Body() dto: GetContractExtensionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.getExtensionsByContractId(
      dto.contractId,
      user.id,
    );
  }
}
