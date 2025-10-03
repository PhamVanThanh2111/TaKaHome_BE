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
    summary:
      'Chuẩn bị PDF: thêm placeholder chữ ký (2 vị trí) với ByteRange placeholders (*)',
  })
  @ApiBody({ type: PreparePDFDto })
  async prepare(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PreparePDFDto,
    @Res() res: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file "pdf"');
    }

    // helper: parse rect -> [x, y, w, h]
    const parseRect = (raw?: string) => {
      if (!raw) return undefined;
      try {
        // Clean the input string: remove BOM, trim whitespace, and handle quotes
        let cleanedRaw = raw.toString().trim();

        // Remove BOM if present
        if (cleanedRaw.charCodeAt(0) === 0xfeff) {
          cleanedRaw = cleanedRaw.slice(1);
        }

        // If string is wrapped in quotes, remove them
        if (
          (cleanedRaw.startsWith('"') && cleanedRaw.endsWith('"')) ||
          (cleanedRaw.startsWith("'") && cleanedRaw.endsWith("'"))
        ) {
          cleanedRaw = cleanedRaw.slice(1, -1);
        }

        let v: unknown;

        // Try parsing as JSON array first: [50,50,250,120]
        if (cleanedRaw.startsWith('[') && cleanedRaw.endsWith(']')) {
          v = JSON.parse(cleanedRaw);
        } else {
          // Try parsing as comma-separated values: 50,50,250,120
          const parts = cleanedRaw.split(',').map((part) => {
            const num = Number(part.trim());
            if (!Number.isFinite(num)) {
              throw new Error(`Invalid number: ${part}`);
            }
            return num;
          });
          v = parts;
        }

        if (
          Array.isArray(v) &&
          v.length === 4 &&
          v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ) {
          return v as [number, number, number, number];
        }
      } catch (err) {
        console.warn('Cannot parse rect:', {
          error: err as Error,
          input: raw,
          inputType: typeof raw,
          inputLength: raw?.length,
        });
      }
      return undefined;
    };

    const places: Array<{
      page?: number;
      rect?: [number, number, number, number];
      signatureLength?: number;
    }> = [];

    // placeholder #1
    places.push({
      page: body.page !== undefined ? Number(body.page) : undefined,
      rect: parseRect(body.rect),
      signatureLength:
        body.signatureLength !== undefined
          ? Number(body.signatureLength)
          : 65536, // Default 64KB for large ByteRange area + signature
    });

    // placeholder #2 (optional)
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
            : 65536, // Default 64KB for large ByteRange area + signature
      });
    }

    const prepared = await this.contractService.preparePlaceholder(
      Buffer.from(file.buffer),
      {
        places,
      },
    );
    
    // REMOVED: No longer finalize ByteRange in /prepare - it will be done in /embed-cms
    // const finalized = this.contractService.finalizeAllByteRanges(prepared);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prepared.pdf"');
    res.setHeader('Content-Length', String(prepared.length));
    return res.end(prepared);
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

  @Post('embed-cms')
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Nhúng CMS (PKCS#7) vào placeholder (KHÔNG đổi ByteRange)',
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
          description: 'PDF đã prepare (có placeholder ByteRange với *)',
        },
        signatureIndex: {
          type: 'string',
          example: '0',
          description: 'Index placeholder (0-based), mặc định 0',
        },
        cmsBase64: {
          type: 'string',
          description: 'CMS/PKCS#7 dạng Base64 (ưu tiên)',
          example: 'MIIG...==',
        },
        cmsHex: {
          type: 'string',
          description: 'CMS/PKCS#7 dạng Hex (nếu không dùng base64)',
          example: '3082...A0F',
        },
      },
    },
  })
  embedCms(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { signatureIndex?: string; cmsBase64?: string; cmsHex?: string },
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

    console.log(`[POST] /contracts/embed-cms with signatureIndex: ${signatureIndex}`);

    const cmsBase64 = (body.cmsBase64 || '').trim();
    const cmsHex = (body.cmsHex || '').trim();

    if (!cmsBase64 && !cmsHex) {
      throw new BadRequestException('Missing CMS: provide cmsBase64 or cmsHex');
    }
    if (cmsBase64 && cmsHex) {
      throw new BadRequestException('Provide only one of cmsBase64 or cmsHex');
    }

    // Convert CMS input to hex string
    let cmsHexString: string;
    if (cmsHex) {
      cmsHexString = cmsHex;
    } else {
      // Convert base64 to hex
      const buf = Buffer.from(cmsBase64, 'base64');
      cmsHexString = buf.toString('hex').toUpperCase();
    }

    const signed = this.contractService.embedCmsAtIndex(
      Buffer.from(file.buffer),
      cmsHexString,
      signatureIndex,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="signed.pdf"');
    res.setHeader('Content-Length', String(signed.length));
    return res.end(signed);
  }

  @Post('smartca/sign-to-cms')
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'VNPT SmartCA: ký DER(SignedAttributes) và TRẢ VỀ CMS (không embed)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf'],
      properties: {
        pdf: { type: 'string', format: 'binary' },
        signatureIndex: { type: 'integer', default: 0 },
        intervalMs: { type: 'integer', default: 2000 },
        timeoutMs: { type: 'integer', default: 120000 },
        userIdOverride: { type: 'string' },
      },
    },
  })
  async signToCms(
    @UploadedFile() file: Express.Multer.File,
    @Body('signatureIndex') signatureIndexRaw?: string,
    @Body('intervalMs') intervalMsRaw?: string,
    @Body('timeoutMs') timeoutMsRaw?: string,
    @Body('userIdOverride') userIdOverride?: string,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Missing file "pdf"');

    const signatureIndex = Number.isFinite(Number(signatureIndexRaw))
      ? Number(signatureIndexRaw)
      : 0;
    const intervalMs = Number.isFinite(Number(intervalMsRaw))
      ? Number(intervalMsRaw)
      : 2000;
    const timeoutMs = Number.isFinite(Number(timeoutMsRaw))
      ? Number(timeoutMsRaw)
      : 120000;

    console.log(`[POST] /contracts/smartca/sign-to-cms with signatureIndex: ${signatureIndex}`);

    const result = await this.contractService.signToCmsPades({
      pdf: Buffer.from(file.buffer),
      signatureIndex,
      userIdOverride: userIdOverride?.trim() || undefined,
      intervalMs,
      timeoutMs,
    });

    // Trả JSON (để client dùng cmsBase64 gọi /embed-cms)
    return {
      message: 'CMS_READY',
      cmsBase64: result.cmsBase64,
      transactionId: result.transactionId,
      docId: result.docId,
      signatureIndex: result.signatureIndex,
      byteRange: result.byteRange,
      pdfLength: result.pdfLength,
      digestHex: result.digestHex as string,
    };
  }
}
