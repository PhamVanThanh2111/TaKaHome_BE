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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ContractResponseDto } from './dto/contract-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PreparePDFDto } from './dto/prepare-pdf.dto';
import { ComputeHashDto } from './dto/compute-hash.dto';

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

  @UseInterceptors(FileInterceptor('pdf'))
  @Post('prepare')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Chuẩn bị PDF: thêm placeholder chữ ký (2 vị trí)',
  })
  @ApiBody({
    type: PreparePDFDto,
  })
  async prepare(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PreparePDFDto,
    @Res() res: Response,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Missing file "pdf"');

    // helper parse rect JSON -> tuple
    const parseRect = (raw?: string) => {
      if (!raw) return undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length === 4 &&
          parsed.every((n) => typeof n === 'number' && Number.isFinite(n))
        ) {
          return parsed as [number, number, number, number];
        }
      } catch {
        // ignore
      }
      return undefined;
    };

    const places: {
      page?: number;
      rect?: [number, number, number, number];
      signatureLength?: number;
    }[] = [];

    // placeholder #1 (giữ nguyên như cũ)
    places.push({
      page: body.page !== undefined ? Number(body.page) : undefined,
      rect: parseRect(body.rect),
      signatureLength:
        body.signatureLength !== undefined
          ? Number(body.signatureLength)
          : undefined,
    });

    // placeholder #2 (nếu có)
    const hasSecond =
      body.page2 !== undefined ||
      body.rect2 !== undefined ||
      body.signatureLength2 !== undefined;

    if (hasSecond) {
      places.push({
        page: body.page2 !== undefined ? Number(body.page2) : undefined,
        rect: parseRect(body.rect2),
        signatureLength:
          body.signatureLength2 !== undefined
            ? Number(body.signatureLength2)
            : undefined,
      });
    }

    const prepared = await this.contractService.preparePlaceholder(
      file.buffer,
      {
        places,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prepared.pdf"');
    return res.send(prepared);
  }

  @Post('hash')
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Tính hash (SHA256) theo ByteRange cho placeholder signature',
  })
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(ComputeHashDto) },
        {
          type: 'object',
          required: ['pdf'],
          properties: {
            pdf: { type: 'string', format: 'binary' },
          },
        },
      ],
    },
  })
  computeHash(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ComputeHashDto,
    @Res() res: Response,
  ) {
    if (!file || !file.buffer || !file.buffer.length) {
      throw new BadRequestException('Missing file "pdf"');
    }

    const idx =
      body.signatureIndex !== undefined ? Number(body.signatureIndex) : 0;
    if (Number.isNaN(idx) || idx < 0) {
      throw new BadRequestException('Invalid signatureIndex');
    }

    const result = this.contractService.computeHashForSignature(
      file.buffer,
      idx,
    );
    // trả json
    return res.json(result);
  }

  @Post('mock-cms')
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Tạo CMS (PKCS#7) mock (detached, SHA-256) cho placeholder chỉ định',
    description:
      'Dùng để test nhúng chữ ký khi chưa có SmartCA. Nhận PDF + signatureIndex, trả về cmsBase64 & cmsHex.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf'],
      properties: {
        pdf: { type: 'string', format: 'binary' },
        signatureIndex: {
          type: 'string',
          example: '0',
          description: 'Index placeholder (0-based), mặc định 0.',
        },
      },
    },
  })
  createMockCms(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { signatureIndex?: string },
    @Res() res: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file "pdf"');
    }
    const idx =
      body.signatureIndex !== undefined ? Number(body.signatureIndex) : 5;
    if (!Number.isFinite(idx) || idx < 0) {
      throw new BadRequestException('Invalid signatureIndex');
    }

    const result = this.contractService.generateMockCmsForPdf(file.buffer, idx);
    return res.json(result);
  }

  @Post('embed-cms')
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Nhúng CMS (PKCS#7) vào placeholder và hoàn thiện /ByteRange',
    description:
      'Nhận CMS (base64 hoặc hex) từ CA và ghi vào /Contents của placeholder chỉ định (signatureIndex).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf'],
      properties: {
        pdf: {
          type: 'string',
          format: 'binary',
          description: 'File PDF đã có placeholder',
        },
        signatureIndex: {
          type: 'string',
          example: '0',
          description: 'Index placeholder (0-based). Mặc định 0.',
        },
        cmsBase64: {
          type: 'string',
          description: 'CMS/PKCS#7 dạng base64 (ưu tiên dùng)',
          example: 'MIIG...==',
        },
        cmsHex: {
          type: 'string',
          description: 'CMS/PKCS#7 dạng hex (nếu không dùng base64)',
          example: '3082...A0F',
        },
      },
    },
  })
  async embedCms(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      signatureIndex?: string;
      cmsBase64?: string;
      cmsHex?: string;
    },
    @Res() res: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file "pdf"');
    }

    const signatureIndex =
      body.signatureIndex !== undefined ? Number(body.signatureIndex) : 0;
    if (!Number.isFinite(signatureIndex) || signatureIndex < 0) {
      throw new BadRequestException('Invalid signatureIndex');
    }

    const cmsBase64 = (body.cmsBase64 || '').trim();
    const cmsHex = (body.cmsHex || '').trim();

    if (!cmsBase64 && !cmsHex) {
      throw new BadRequestException('Missing CMS: provide cmsBase64 or cmsHex');
    }
    if (cmsBase64 && cmsHex) {
      throw new BadRequestException('Provide only one of cmsBase64 or cmsHex');
    }

    // Gọi service với object inputs
    const signed = await this.contractService.embedCmsIntoPlaceholder(
      Buffer.from(file.buffer),
      {
        cmsBase64: cmsBase64 || undefined,
        cmsHex: cmsHex || undefined,
        signatureIndex,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="signed.pdf"');
    res.setHeader('Content-Length', String(signed.length));
    return res.end(signed);
  }
}
