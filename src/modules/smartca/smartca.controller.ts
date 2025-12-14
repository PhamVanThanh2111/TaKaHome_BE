/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { SMARTCA_ERRORS } from 'src/common/constants/error-messages.constant';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';

import { SmartCAService } from './smartca.service';
import { CertificateService } from './certificate.service';
import { UserService } from '../user/user.service';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Place } from './types/smartca.types';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { PreparePDFDto } from './dto/prepare-pdf.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from '../core/auth/guards/roles.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('smartca')
export class SmartCAController {
  private readonly logger = new Logger(SmartCAController.name);
  constructor(
    private readonly smartcaService: SmartCAService,
    private readonly certificateService: CertificateService,
    private readonly userService: UserService,
  ) {}

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
      throw new BadRequestException(SMARTCA_ERRORS.MISSING_PDF_FILE);
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
        intervalMs: { type: 'integer', default: 1000 },
        timeoutMs: { type: 'integer', default: 60000 },
        userIdOverride: { type: 'string' },
        contractId: {
          type: 'string',
          description: 'Contract ID for docId generation',
        },
        signingOption: { type: 'string', description: 'SELF_CA or VNPT' },
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
    @Body('signingOption') signingOption?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException(SMARTCA_ERRORS.MISSING_PDF_FILE);

    // Debug log entry
    this.logger.debug(
      `[signToCms] entry: signatureIndex=${signatureIndexRaw}, intervalMs=${intervalMsRaw}, timeoutMs=${timeoutMsRaw}, userIdOverride=${userIdOverride}, contractId=${contractId}, signingOption=${signingOption}`,
    );

    const signatureIndex = Number.isFinite(Number(signatureIndexRaw))
      ? Number(signatureIndexRaw)
      : 0;
    const intervalMs = Number.isFinite(Number(intervalMsRaw))
      ? Number(intervalMsRaw)
      : 1000;
    const timeoutMs = Number.isFinite(Number(timeoutMsRaw))
      ? Number(timeoutMsRaw)
      : 60000;

    try {
      const finalOption = (signingOption || 'VNPT').toUpperCase();
      this.logger.debug(`[signToCms] resolved finalOption=${finalOption}`);

      if (finalOption === 'SELF_CA') {
        // For SELF_CA we MUST use authenticated user id (from JWT) and ignore userIdOverride/contractId
        if (!user?.id) {
          throw new BadRequestException(
            'userId is required for SELF_CA signing (authenticate to obtain user id)',
          );
        }

        this.logger.debug(
          `[signToCms] SELF_CA start for user=${user.id}, signatureIndex=${signatureIndex}`,
        );

        const result = await this.certificateService.signPdfWithUserKey(
          user.id,
          Buffer.from(file.buffer),
          signatureIndex,
        );

        this.logger.debug(
          `[signToCms] SELF_CA finished for user=${user.id}, cmsBase64Present=${!!result.cmsBase64}`,
        );

        // Always return CMS (base64) for the client to embed via /embed-cms.
        if (!result.cmsBase64) {
          throw new BadRequestException(SMARTCA_ERRORS.GENERATE_CMS_FAILED_SELF_CA);
        }

        this.logger.debug(
          `[signToCms] returning CMS to client for user=${user.id}`,
        );
        // Also write to stdout directly to ensure visibility in environments where debug logs may be filtered
         
        console.log(`[signToCms] returning CMS to client for user=${user.id}`);

        return {
          message: 'CMS_READY',
          cmsBase64: result.cmsBase64,
          signatureIndex,
          signerName: user.fullName || undefined,
        };
        // NOTE: client may call /embed-cms with signerName set to user's full name to display nicer info.
      }

      // Default: VNPT flow
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

  @Post('create-certificate')
  @ApiOperation({
    summary: 'Generate self-signed certificate for a user (signed by Root CA)',
  })
  async createCertificate(@CurrentUser() user: JwtUser) {
    if (!user.id) throw new BadRequestException(SMARTCA_ERRORS.USER_ID_REQUIRED);
    // Reverted: allow creating certificate even if JWT lacks fullName.
    // The CertificateService will fallback to a default subject CN (user-<id>) when fullName is not provided.
    const res = await this.certificateService.generateUserKeyAndCert(user.id, {
      fullName: user.fullName?.trim(),
      email: user.email,
    });
    return { message: 'CERT_CREATED', certificate: res };
  }

  @Post('revoke-certificate')
  @Roles('ADMIN')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['serialNumber'],
      properties: {
        serialNumber: { type: 'string', example: '1234567890ABCDEF' },
      },
    },
  })
  @ApiOperation({
    summary: 'Revoke certificate by serial number (mark revoked in DB)',
  })
  async revokeCertificate(@Body() body: { serialNumber: string }) {
    if (!body?.serialNumber)
      throw new BadRequestException(SMARTCA_ERRORS.SERIAL_NUMBER_REQUIRED);
    const res = await this.certificateService.revokeCertificate(
      body.serialNumber,
    );
    return { message: 'REVOKED', ...res };
  }

  @Post('list-local-certificates')
  @ApiOperation({ summary: 'List certificates issued by SELF_CA for a user' })
  async listLocalCertificates(@Body() body: { userId: string }) {
    if (!body?.userId) throw new BadRequestException(SMARTCA_ERRORS.USER_ID_REQUIRED);
    // Simple query via repository through service
    const repo = (this.certificateService as any).certRepo;
    const list = await repo.find({ where: { userId: body.userId } });
    return { message: 'SUCCESS', total: list.length, certificates: list };
  }

  @Post('crl')
  @ApiOperation({ summary: 'Get list of revoked serial numbers (simple CRL)' })
  async crl() {
    const repo = (this.certificateService as any).certRepo;
    const revoked = await repo.find({ where: { revoked: true } });
    const serials = revoked.map((r: any) => ({
      serialNumber: r.serialNumber,
      revokedAt: r.revokedAt,
    }));
    return { message: 'OK', revoked: serials };
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
        signerName: {
          type: 'string',
          description:
            'Tên người ký để hiển thị trong thông tin Signed by (optional). If provided, will replace /Name in signature dictionary.',
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
    body: {
      signatureIndex?: string;
      cmsBase64?: string;
      cmsHex?: string;
      signerName?: string;
    },
    @Res() res: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(SMARTCA_ERRORS.MISSING_PDF_FILE);
    }

    const signatureIndex =
      body.signatureIndex !== undefined ? Number(body.signatureIndex) : 0;
    if (!Number.isFinite(signatureIndex) || signatureIndex < 0) {
      throw new BadRequestException(SMARTCA_ERRORS.INVALID_SIGNATURE_INDEX);
    }

    const cmsBase64 = (body.cmsBase64 || '').trim();
    const cmsHex = (body.cmsHex || '').trim();
    const signerName = ((body as any).signerName || '').trim();

    if (!cmsBase64 && !cmsHex) {
      throw new BadRequestException(SMARTCA_ERRORS.MISSING_CMS_DATA);
    }
    if (cmsBase64 && cmsHex) {
      throw new BadRequestException(SMARTCA_ERRORS.PROVIDE_ONLY_ONE_CMS_FORMAT);
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

    let pdfToEmbed = Buffer.from(file.buffer);
    if (signerName) {
      // Update signature dictionary /Name to show provided signer name
      pdfToEmbed = this.smartcaService.setSignerNameInSigDict(
        pdfToEmbed as any,
        signatureIndex,
        signerName,
      ) as any;
    }

    const signed = this.smartcaService.embedCmsAtIndex(
      pdfToEmbed,
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
      throw new BadRequestException(SMARTCA_ERRORS.MISSING_PDF_FILE);
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
        intervalMs: { type: 'integer', default: 1000 },
        timeoutMs: { type: 'integer', default: 60000 },
        reason: { type: 'string', default: 'Digitally signed' },
        location: { type: 'string', default: 'Vietnam' },
        contactInfo: { type: 'string' },
        signerName: { type: 'string', default: 'Digital Signature' },
        creator: { type: 'string', default: 'SmartCA VNPT 2025' },
        signingOption: { type: 'string', description: 'SELF_CA or VNPT' },
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
      signingOption?: string;
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
        intervalMs: body.intervalMs ? Number(body.intervalMs) : 1000,
        timeoutMs: body.timeoutMs ? Number(body.timeoutMs) : 60000,
        reason: body.reason?.trim() || 'Digitally signed',
        location: body.location?.trim() || 'Vietnam',
        contactInfo: body.contactInfo?.trim() || '',
        signerName: body.signerName?.trim() || 'Digital Signature',
        creator: body.creator?.trim() || 'SmartCA VNPT 2025',
        signingOption: body.signingOption?.trim() || 'SELF_CA',
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

  @UseInterceptors(FileInterceptor('pdf'))
  @Post('verify-self-ca-signature')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Xác minh chữ ký số SELF_CA trong PDF',
    description:
      'API kiểm tra và xác minh chữ ký số được ký bằng chứng thư số do hệ thống tự cấp (SELF_CA). ' +
      'Trả về kết quả xác minh bao gồm thông tin người ký, thời gian ký và trạng thái hợp lệ.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf'],
      properties: {
        pdf: {
          type: 'string',
          format: 'binary',
          description: 'File PDF đã được ký bằng SELF_CA cần kiểm tra',
        },
        signatureIndex: {
          type: 'string',
          example: '0',
          description:
            'Chỉ số chữ ký cần kiểm tra (0: chữ ký đầu tiên, 1: chữ ký thứ hai)',
          default: '0',
        },
      },
    },
  })
  verifySelfCASignature(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { signatureIndex?: string },
  ) {
    try {
      if (!file?.buffer?.length) {
        throw new BadRequestException(SMARTCA_ERRORS.MISSING_PDF_FILE);
      }

      const signatureIndex = body.signatureIndex
        ? parseInt(body.signatureIndex, 10)
        : 0;

      if (signatureIndex < 0 || signatureIndex > 1) {
        throw new BadRequestException(
          'signatureIndex must be 0 (first signature) or 1 (second signature)',
        );
      }

      const result = this.smartcaService.verifySelfCASignature(
        file.buffer,
        signatureIndex,
      );

      return {
        success: true,
        message: result.isValid
          ? 'Signature verification successful'
          : 'Signature verification failed',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        '[verifySelfCASignature] Error:',
        error instanceof Error ? error.message : error,
      );

      return {
        success: false,
        message: 'VERIFICATION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
