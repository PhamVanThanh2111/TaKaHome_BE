import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
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

@ApiBearerAuth()
@Controller('smartca')
export class SmartCAController {
  constructor(private readonly smartcaService: SmartCAService) {}

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

    const prepared = await this.smartcaService.preparePlaceholder(
      Buffer.from(file.buffer),
      {
        places,
      },
    );

    // REMOVED: No longer finalize ByteRange in /prepare - it will be done in /embed-cms
    // const finalized = this.smartcaService.finalizeAllByteRanges(prepared);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prepared.pdf"');
    res.setHeader('Content-Length', String(prepared.length));
    return res.end(prepared);
  }
}
