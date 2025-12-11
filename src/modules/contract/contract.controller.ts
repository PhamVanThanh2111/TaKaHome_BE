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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ContractService } from './contract.service';
import { ContractExtensionService } from './contract-extension.service';
import { PdfFillService, PdfTemplateType } from './pdf-fill.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { FillPdfDto } from './dto/fill-pdf.dto';
import { CreateContractExtensionDto } from './dto/create-contract-extension.dto';
import { RespondContractExtensionDto } from './dto/respond-contract-extension.dto';
import { TenantRespondExtensionDto } from './dto/tenant-respond-extension.dto';
import { GetContractExtensionsDto } from './dto/get-contract-extensions.dto';
import { ContractExtensionResponseDto } from './dto/contract-extension-response.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
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
    private readonly pdfFillService: PdfFillService,
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
    return this.contractService.terminateContract(
      id,
      'Admin manually terminated contract',
      'ADMIN',
    );
  }

  @Get(':id/file-url')
  @ApiOperation({ summary: 'Lấy URL truy cập file hợp đồng.' })
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        signingOption: {
          type: 'string',
          description: 'Lựa chọn phương thức ký số (VNPT hoặc SELF_CA)',
          example: 'SELF_CA',
        },
      },
    },
  })
  landlordSignExtension(
    @Param('id') extensionId: string,
    @Body('signingOption') signingOption: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.landlordSignExtension(
      extensionId,
      user.id,
      signingOption,
    );
  }

  @Patch('extensions/:id/tenant-sign')
  @ApiOperation({ summary: 'Người thuê ký hợp đồng gia hạn' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ký thành công' })
  @Roles(RoleEnum.TENANT)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        signingOption: {
          type: 'string',
          description: 'Lựa chọn phương thức ký số (VNPT hoặc SELF_CA)',
          example: 'SELF_CA',
        },
      },
    },
  })
  tenantSignExtension(
    @Param('id') extensionId: string,
    @Body('signingOption') signingOption: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contractExtensionService.tenantSignExtension(
      extensionId,
      user.id,
      signingOption,
    );
  }

  @Post('extensions/list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách contract extensions theo contractId',
    description:
      'API này cho phép lấy danh sách tất cả các yêu cầu gia hạn của một hợp đồng. Người dùng phải là TENANT hoặc LANDLORD của hợp đồng đó.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách contract extensions được trả về thành công',
    type: [ContractExtensionResponseDto],
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Contract extensions retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ContractExtensionResponseDto' },
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
    description:
      'Không có quyền truy cập - chỉ tenant hoặc landlord mới có thể xem',
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

  // ================================
  // PDF Template Testing Endpoints
  // ================================

  @Get('test/template-fields/:templateType')
  @ApiOperation({
    summary: 'Lấy danh sách các field trong PDF template',
    description:
      'API để kiểm tra các field có sẵn trong file PDF template theo loại',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách các field trong template',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'SUCCESS' },
        data: {
          type: 'object',
          properties: {
            templateType: {
              type: 'string',
              example: 'HopDongChoThueNhaNguyenCan',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              example: [
                'landlord_name',
                'tenant_name',
                'landlord_cccd',
                'tenant_cccd',
              ],
            },
          },
        },
      },
    },
  })
  async getTemplateFields(@Param('templateType') templateType: string) {
    // Validate templateType
    const validTypes = Object.values(PdfTemplateType);
    if (!validTypes.includes(templateType as PdfTemplateType)) {
      throw new Error(
        `Invalid template type. Valid types: ${validTypes.join(', ')}`,
      );
    }

    const fields = await this.pdfFillService.getTemplateFields(
      templateType as PdfTemplateType,
    );
    return {
      statusCode: 200,
      message: 'SUCCESS',
      data: {
        templateType,
        fields,
      },
    };
  }

  @Post('test/fill-pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test điền thông tin vào PDF template',
    description:
      'API test để điền thông tin vào các field trong PDF template và trả về file PDF đã điền. Hỗ trợ nhiều loại template và tự động bỏ qua các field không tồn tại.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File PDF đã được điền thông tin',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ',
  })
  @ApiBody({ type: FillPdfDto })
  async testFillPdf(@Body() dto: FillPdfDto, @Res() res: Response) {
    // Chuẩn bị dữ liệu để điền vào PDF từ tất cả các field trong DTO
    const fieldValues: Record<string, string> = {};

    // Các field bắt buộc
    fieldValues.landlord_name = dto.landlord_name;
    fieldValues.tenant_name = dto.tenant_name;
    fieldValues.landlord_cccd = dto.landlord_cccd;
    fieldValues.tenant_cccd = dto.tenant_cccd;

    // Các field optional - chỉ thêm nếu có giá trị
    if (dto.landlord_phone) fieldValues.landlord_phone = dto.landlord_phone;
    if (dto.tenant_phone) fieldValues.tenant_phone = dto.tenant_phone;
    if (dto.address) fieldValues.address = dto.address;
    if (dto.area) fieldValues.area = dto.area;
    if (dto.rent) fieldValues.rent = dto.rent;
    if (dto.deposit) fieldValues.deposit = dto.deposit;
    if (dto.date) fieldValues.date = dto.date;
    if (dto.landlord_sign) fieldValues.landlord_sign = dto.landlord_sign;
    if (dto.tenant_sign) fieldValues.tenant_sign = dto.tenant_sign;

    // Điền thông tin vào PDF với template được chỉ định
    const pdfBuffer = await this.pdfFillService.fillPdfTemplate(
      fieldValues,
      dto.templateType,
    );

    // Tạo tên file dựa trên template type
    const fileName = `${dto.templateType}-filled.pdf`;

    // Trả về file PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}
