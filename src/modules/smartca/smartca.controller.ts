import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';

import { SmartCAService } from './smartca.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { PreparePDFDto } from '../contract/dto/prepare-pdf.dto';
import { Response } from 'express';
import { Place } from './types/smartca.types';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('smartca')
export class SmartCAController {
  constructor(private readonly smartcaService: SmartCAService) {}

  @UseInterceptors(FileInterceptor('pdf'))
  @Post('prepare')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Chuẩn bị PDF: thêm 1 placeholder chữ ký với ByteRange placeholders (*)',
  })
  @ApiBody({ type: PreparePDFDto })
  prepare(
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

    // Create single placeholder
    const place: Place = {
      page: body.page !== undefined ? Number(body.page) : undefined,
      rect: parseRect(body.rect),
      signatureLength:
        body.signatureLength !== undefined
          ? Number(body.signatureLength)
          : 4096, // Default 4KB - matches NEAC compliance (3993 bytes observed)
      // NEAC compliance metadata
      reason: body.reason?.trim() || 'Digitally signed',
      location: body.location?.trim() || 'Vietnam',
      contactInfo: body.contactInfo?.trim() || '',
      name: body.signerName?.trim() || 'Digital Signature',
      creator: body.creator?.trim() || 'SmartCA VNPT 2025',
    };
    places.push(place);

    const prepared = this.smartcaService.preparePlaceholder(
      Buffer.from(file.buffer),
      {
        places,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prepared.pdf"');
    res.setHeader('Content-Length', String(prepared.length));
    return res.end(prepared);
  }

  @Post('sign-to-cms')
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
        contractId: {
          type: 'string',
          description: 'Contract ID for docId generation',
        },
      },
    },
  })
  async signToCms(
    @UploadedFile() file: Express.Multer.File,
    @Body('signatureIndex') signatureIndexRaw?: string,
    @Body('intervalMs') intervalMsRaw?: string,
    @Body('timeoutMs') timeoutMsRaw?: string,
    @Body('userIdOverride') userIdOverride?: string,
    @Body('contractId') contractId?: string,
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

    try {
      const result = await this.smartcaService.signToCmsPades({
        pdf: Buffer.from(file.buffer),
        signatureIndex,
        userIdOverride: userIdOverride?.trim() || undefined,
        contractId: contractId?.trim() || undefined,
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
        digestHex: result.digestHex,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during signing process';
      const errorStatus = Number((error as { status?: number })?.status) || 500;

      console.error('[SIGN-TO-CMS] Error:', errorMessage);

      // Ensure JSON response even on error
      return {
        message: 'SIGNING_FAILED',
        error: errorMessage,
        code: errorStatus,
      };
    }
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

    const signed = this.smartcaService.embedCmsAtIndex(
      Buffer.from(file.buffer),
      cmsHexString,
      signatureIndex,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="signed.pdf"');
    res.setHeader('Content-Length', String(signed.length));
    return res.end(signed);
  }

  @Post('debug/scan')
  @ApiOperation({
    summary: 'Quét chữ ký trong PDF (debug)',
    description:
      'Đọc PDF và trả thông tin từng chữ ký: vị trí <...>, /ByteRange (bên trong đúng signature dictionary), v.v.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  scan(
    @UploadedFile() file: Express.Multer.File,
  ): Array<Record<string, unknown>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }
    return this.smartcaService.debugScanSignatures(file.buffer) as Array<
      Record<string, unknown>
    >;
  }

  @Post('list-certificates')
  @ApiOperation({
    summary: 'Lấy danh sách chứng thư số của user',
    description:
      'Liệt kê tất cả certificates để user chọn serial_number cho signing',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIdOverride: {
          type: 'string',
          description: 'User ID override (optional)',
        },
      },
    },
  })
  async listCertificates(@Body('userIdOverride') userIdOverride?: string) {
    const result = await this.smartcaService.getCertificates({
      userId: userIdOverride?.trim() || undefined,
    });

    if (result.status !== 200) {
      throw new BadRequestException(
        `Failed to get certificates: ${result.status}`,
      );
    }

    // Define a type for certificate to avoid 'any'
    type Certificate = {
      serial_number: string;
      cert_status: string;
      cert_status_code: string;
      valid_from: string;
      valid_to: string;
      subject: string;
      issuer: string;
      service_type: string;
      [key: string]: unknown;
    };

    // Format response để dễ đọc
    const certificates = (result.certificates as Certificate[]).map((cert) => ({
      serial_number: cert.serial_number,
      cert_status: cert.cert_status,
      cert_status_code: cert.cert_status_code,
      valid_from: cert.valid_from,
      valid_to: cert.valid_to,
      subject: cert.subject,
      issuer: cert.issuer,
      service_type: cert.service_type,
    }));

    return {
      message: 'SUCCESS',
      totalCertificates: certificates.length,
      certificates,
    };
  }

  @Post('sign-oneshot')
  @ApiOperation({
    summary: 'OneShot PDF Signing - Complete flow trong 1 API',
    description:
      'Thực hiện toàn bộ flow: prepare → sign via VNPT → poll → embed CMS → return signed PDF sử dụng file PDF từ assets',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        signatureIndex: { type: 'integer', default: 0 },
        userIdOverride: { type: 'string' },
        contractId: {
          type: 'string',
          description: 'Contract ID for docId generation',
        },
        intervalMs: { type: 'integer', default: 2000 },
        timeoutMs: { type: 'integer', default: 120000 },
        reason: { type: 'string', default: 'Digitally signed' },
        location: { type: 'string', default: 'Vietnam' },
        contactInfo: { type: 'string' },
        signerName: { type: 'string', default: 'Digital Signature' },
        creator: { type: 'string', default: 'SmartCA VNPT 2025' },
      },
    },
  })
  async signOneShot(
    @Body()
    body: {
      signatureIndex?: string;
      userIdOverride?: string;
      contractId?: string;
      intervalMs?: string;
      timeoutMs?: string;
      reason?: string;
      location?: string;
      contactInfo?: string;
      signerName?: string;
      creator?: string;
    },
    @Res() res: Response,
  ) {
    try {
      // Read PDF file from assets
      const pdfPath = path.join(
        process.cwd(),
        'src',
        'assets',
        'contracts',
        'HopDongChoThueNhaNguyenCan.pdf',
      );

      if (!fs.existsSync(pdfPath)) {
        throw new BadRequestException(`PDF file not found at: ${pdfPath}`);
      }

      const pdfBuffer = fs.readFileSync(pdfPath);

      const result = await this.smartcaService.signPdfOneShot({
        pdfBuffer,
        signatureIndex: body.signatureIndex ? Number(body.signatureIndex) : 0,
        userIdOverride: body.userIdOverride?.trim() || undefined,
        contractId: body.contractId?.trim() || undefined,
        intervalMs: body.intervalMs ? Number(body.intervalMs) : 2000,
        timeoutMs: body.timeoutMs ? Number(body.timeoutMs) : 120000,
        reason: body.reason?.trim() || 'Digitally signed',
        location: body.location?.trim() || 'Vietnam',
        contactInfo: body.contactInfo?.trim() || '',
        signerName: body.signerName?.trim() || 'Digital Signature',
        creator: body.creator?.trim() || 'SmartCA VNPT 2025',
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'SIGNING_FAILED',
          error: result.error,
          metadata: result.metadata,
        });
      }

      // Return signed PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="signed-oneshot.pdf"',
      );
      res.setHeader('Content-Length', String(result.signedPdf!.length));

      // Add metadata to response headers for debugging
      res.setHeader('X-Transaction-Id', result.transactionId || '');
      res.setHeader('X-Doc-Id', result.docId || '');
      res.setHeader(
        'X-Processing-Time',
        String(result.metadata?.processingTimeMs || 0),
      );
      res.setHeader(
        'X-Original-Size',
        String(result.metadata?.originalSize || 0),
      );
      res.setHeader('X-Signed-Size', String(result.metadata?.signedSize || 0));

      return res.end(result.signedPdf);
    } catch (error) {
      console.error('[OneShot API] ❌ Error:', error);

      return res.status(500).json({
        success: false,
        message: 'ONESHOT_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
