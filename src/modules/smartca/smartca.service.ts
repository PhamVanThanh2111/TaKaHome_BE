/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { randomUUID } from 'crypto';
import axios from 'axios';
import smartcaConfig from 'src/config/smartca.config';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import {
  PlainAddPlaceholderInput,
  Place,
  PrepareOptions,
  SmartCASignResponse,
  SmartCAUserCertificate,
} from './types/smartca.types';

const OID_SHA256 = forge.pki.oids.sha256 as string;
const OID_RSA = forge.pki.oids.rsaEncryption as string;

export { SmartCASignResponse };

// time_stamp: YYYYMMDDhhmmssZ (UTC, không có 'T')
function utcTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate(),
  )}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

@Injectable()
export class SmartCAService {
  constructor(
    @Inject(smartcaConfig.KEY)
    private readonly smartca: ConfigType<typeof smartcaConfig>,
  ) {}

  preparePlaceholder(pdfBuffer: Buffer, options: PrepareOptions): Buffer {
    const places: Place[] = 'places' in options ? options.places : [options];

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('pdfBuffer must be a Buffer');
    }
    if (!places.length) return Buffer.from(pdfBuffer);

    const defaultRect: [number, number, number, number] = [50, 50, 250, 120];

    // 1) Add placeholders for each signature place
    let out = Buffer.from(pdfBuffer);

    // Process all places to create multiple signatures
    for (const p of places) {
      const rect = p.rect ?? defaultRect;
      const name = p.name?.trim() || 'Signature1';
      const signatureLength = Number.isFinite(p.signatureLength as number)
        ? Number(p.signatureLength)
        : 12000; // đủ rộng cho CMS RSA thông dụng

      if (
        rect.length !== 4 ||
        rect.some((n) => typeof n !== 'number' || !Number.isFinite(n))
      ) {
        throw new BadRequestException('Invalid rect for placeholder');
      }
      if (signatureLength < 4096) {
        throw new BadRequestException(
          'signatureLength too small (>= 4096 recommended)',
        );
      }

      // FORCE larger signature length to ensure enough ByteRange space
      const forceSignatureLength = Math.max(signatureLength, 65536); // Force 64KB minimum

      const opts: PlainAddPlaceholderInput = {
        pdfBuffer: out,
        reason: p.reason ?? 'Digitally signed',
        contactInfo: p.contactInfo ?? '',
        location: p.location ?? '',
        name,
        signatureLength: forceSignatureLength, // Always use large size
        rect,
        page: p.page,
      };

      console.log(
        `Creating placeholder with signatureLength: ${forceSignatureLength}`,
      );
      out = Buffer.from(plainAddPlaceholder(opts));
    }

    // 1.5) REMOVED: Không cần expand ByteRange cho file nhỏ (<500KB)
    console.log(
      '=== Using original ByteRange format (no expansion needed) ===',
    );

    // 2) Parse ALL /ByteRange (placeholders) & /Contents <...> for signatures only
    const s = out.toString('latin1');

    // Accept either numbers or "/****" in ByteRange slots
    const brRe =
      /\/ByteRange\s*\[\s*([0-9/*]+)\s+([0-9/*]+)\s+([0-9/*]+)\s+([0-9/*]+)\s*\]/g;
    const ctRe = /\/Contents\s*<([0-9A-Fa-f\s]+)>/g;

    const byteRanges: { text: string; start: number }[] = [];
    for (let m = brRe.exec(s); m; m = brRe.exec(s)) {
      byteRanges.push({ text: m[0], start: m.index });
    }
    if (!byteRanges.length) {
      throw new BadRequestException('No /ByteRange found after placeholders');
    }

    // collect signature /Contents only: we take the hex region inside <...>
    const contents: { hexStart: number; hexLenChars: number }[] = [];
    for (let m = ctRe.exec(s); m; m = ctRe.exec(s)) {
      const localStart = m.index;
      const lt = s.indexOf('<', localStart);
      const gt = s.indexOf('>', lt + 1);
      if (lt < 0 || gt < 0) continue;
      // skip images/streams: they usually aren’t in dictionaries with /ByteRange nearby,
      // but we still only pair as many as byteRanges length later.
      const hex = s.slice(lt + 1, gt).replace(/\s+/g, '');
      if (!hex.length) continue;
      contents.push({ hexStart: lt + 1, hexLenChars: hex.length });
    }

    // We only need as many /Contents as /ByteRange (pair in order of appearance)
    if (contents.length < byteRanges.length) {
      throw new BadRequestException(
        `Found ${byteRanges.length} /ByteRange but only ${contents.length} /Contents`,
      );
    }

    // 3) REMOVED: No longer calculate/fill ByteRange in /prepare API
    // ByteRange will remain as placeholders (*) and will be calculated in /embed-cms API
    console.log('=== PREPARE API: Leaving ByteRange as placeholders (*) ===');
    console.log(
      `Created ${byteRanges.length} signature placeholders with ${contents.length} contents placeholders`,
    );

    // Log placeholder positions for debugging
    for (let i = 0; i < byteRanges.length; i += 1) {
      const br = byteRanges[i];
      const ct = contents[i];
      console.log(`Placeholder #${i}:`);
      console.log(`  ByteRange position: ${br.start}`);
      console.log(
        `  Contents hex start: ${ct.hexStart}, length: ${ct.hexLenChars}`,
      );
    }

    return out;
  }

  public async signToCmsPades(options: {
    pdf: Buffer;
    signatureIndex?: number;
    userIdOverride?: string;
    intervalMs?: number;
    timeoutMs?: number;
  }) {
    const signatureIndex = options.signatureIndex ?? 0;

    // 1) Locate signature gap first (independent of ByteRange format)
    const gap = this.locateContentsGap(options.pdf, signatureIndex);

    // 2) Try to read declared ByteRange (might be corrupted)
    const decl = this.readDeclaredByteRange(options.pdf, signatureIndex);

    if (decl) {
      const should = gap.byteRangeShouldBe; // [a,b,c,d] kỳ vọng từ locate
      const aOk = decl.a === should[0];
      const bOk = decl.b === should[1];
      const cOk = decl.c === should[2];
      const dOk = decl.d === should[3];

      // Nếu lệch ở a/b/c => offset sai thật, phải chặn
      if (!aOk || !bOk || !cOk) {
        console.warn(
          `ByteRange mismatch detected but will use calculated gap:`,
          {
            declared: [decl.a, decl.b, decl.c, decl.d],
            calculated: should,
          },
        );
      }

      if (!dOk) {
        console.warn(
          `Auto-ignoring ByteRange.d mismatch: declared=${decl.d}, calculated=${should[3]}`,
        );
      }
    } else {
      console.warn(
        `No valid ByteRange found for signature ${signatureIndex}, using calculated gap`,
      );
    }

    // 3) Hash PDF theo gap được tính toán (an toàn hơn)
    const { digestHex: pdfDigestHex } = this.hashForSignatureByGap(
      options.pdf,
      gap,
    ) as { digestHex: string };

    // 2) Lấy cert & serial
    const certResp = await this.getCertificates({
      userId: this.smartca.smartcaUserId,
    });
    if (certResp.status !== 200 || !certResp.certificates?.length) {
      throw new BadRequestException(`get_certificate failed or empty`);
    }
    const { signerPem, chainPem, serial } = this.extractPemChainFromGetCertResp(
      certResp.certificates,
    );
    if (!serial) throw new BadRequestException('No serial_number');

    // 3) Build SignedAttributes DER (có signingCertificateV2)
    const signedAttrsDER = this.buildSignedAttrsDER(pdfDigestHex, signerPem);

    // 4) Hash DER (SHA-256) → gửi ký
    const derHashBytes = crypto
      .createHash('sha256')
      .update(signedAttrsDER)
      .digest();
    const derHashHex = derHashBytes.toString('hex');
    const derHashB64 = derHashBytes.toString('base64');

    const transactionId = 'SP_CA_' + Date.now();
    const docId = 'doc-' + randomUUID();

    await this.requestSmartCASignByHash({
      digestHex: derHashHex,
      digestBase64: derHashB64,
      transactionId,
      docId,
      serialNumber: serial,
      userIdOverride: this.smartca.smartcaUserId,
    });

    // 5) Poll cho tới khi có signature_value
    const poll = await this.pollSmartCASignResult({
      transactionId,
      intervalMs: options.intervalMs ?? 2000,
      timeoutMs: options.timeoutMs ?? 180000, // tăng timeout
    });

    const raw = (poll as any).raw?.data ?? {};
    const st = raw?.status_code;
    if (!st) throw new BadRequestException('No status returned from SmartCA');

    const sig =
      raw?.data?.signature_value ||
      raw?.data?.signatures?.[0]?.signature_value ||
      null;
    if (!sig) {
      throw new BadRequestException('No signature_value in SmartCA result');
    }

    // 6) Lắp CMS detached (Base64)
    const cmsBase64 = this.buildDetachedCMSBase64(
      signedAttrsDER,
      sig,
      signerPem,
      chainPem,
    );

    // 7) Trả về CMS (KHÔNG embed)
    return {
      cmsBase64,
      transactionId,
      docId,
      signatureIndex,
      byteRange: gap,
      pdfLength: options.pdf.length,
      digestHex: pdfDigestHex,
    };
  }

  /**
   * Embed CMS vào placeholder /Contents - KHÔNG thay đổi ByteRange
   * Chỉ thay thế hex content giữa <...> và pad với 0 nếu cần
   */
  public embedCmsAtIndex(
    pdf: Buffer,
    cmsBase64OrHex: string,
    signatureIndex: number,
  ): Buffer {
    console.log('\n=== EMBED CMS DEBUG START ===');
    console.log('Input PDF size:', pdf.length);
    console.log('Signature index:', signatureIndex);
    console.log('CMS input length:', cmsBase64OrHex.length);

    // 1) Normalize CMS to HEX uppercase
    let cmsHex = (cmsBase64OrHex || '').trim();
    const looksHex =
      /^[0-9A-Fa-f\s]+$/.test(cmsHex) &&
      cmsHex.replace(/\s+/g, '').length % 2 === 0;

    console.log('\n=== CMS HEX VALIDATION ===');
    console.log('Original CMS input length:', cmsBase64OrHex.length);
    console.log('Trimmed CMS length:', cmsHex.length);
    console.log('Looks like hex:', looksHex);

    if (!looksHex) {
      try {
        const bytes = Buffer.from(cmsHex, 'base64');
        if (!bytes.length) throw new Error('empty');
        cmsHex = bytes.toString('hex').toUpperCase();
        console.log('Converted from base64 to hex, length:', cmsHex.length);
      } catch (error) {
        console.error('CMS conversion error:', error);
        throw new BadRequestException('CMS must be base64 or hex');
      }
    } else {
      cmsHex = cmsHex.replace(/\s+/g, '').toUpperCase();
      console.log('Using provided hex, length:', cmsHex.length);
      console.log('CMS hex preview:', cmsHex.substring(0, 100) + '...');
      console.log(
        'CMS hex ending:',
        '...' + cmsHex.substring(cmsHex.length - 50),
      );
    }

    // 2) Convert to string for text operations
    const pdfStr = pdf.toString('latin1');
    console.log('PDF as string length:', pdfStr.length);

    // Count total signatures in PDF
    const sigMatches = Array.from(pdfStr.matchAll(/\/Type\s*\/Sig/g));
    const contentsMatches = Array.from(pdfStr.matchAll(/\/Contents\s*<[0]*>/g));
    console.log('Total /Type/Sig entries:', sigMatches.length);
    console.log('Total /Contents placeholders:', contentsMatches.length);

    // 3) Find the Contents placeholder by index - Updated regex to handle any hex content
    const contentsRegex = /\/Contents\s*<([0-9A-Fa-f]*)>/g;
    let match: RegExpExecArray | null;
    let currentIndex = 0;
    let contentsStart = -1;
    let contentsEnd = -1;
    let placeholderContent = '';

    console.log('Searching for Contents placeholders...');

    while ((match = contentsRegex.exec(pdfStr)) !== null) {
      console.log(`Found Contents #${currentIndex} at position ${match.index}`);
      console.log(`  Full match: "${match[0]}"`);
      console.log(`  Content inside brackets: "${match[1] || '(empty)'}"`);

      if (currentIndex === signatureIndex) {
        // FIXED: Calculate positions correctly
        contentsStart = match.index + match[0].indexOf('<');
        contentsEnd = match.index + match[0].lastIndexOf('>') + 1;
        placeholderContent = match[1] || '';

        console.log('Selected Contents placeholder:');
        console.log('  Start position (position of <):', contentsStart);
        console.log('  End position (position after >):', contentsEnd);
        console.log('  Placeholder length:', placeholderContent.length);
        console.log(
          '  Placeholder preview:',
          placeholderContent.substring(0, 50) + '...',
        );
        break;
      }
      currentIndex++;
    }

    if (contentsStart === -1 || contentsEnd === -1) {
      console.error(`Contents placeholder #${signatureIndex} not found`);
      throw new BadRequestException(
        `Contents placeholder #${signatureIndex} not found`,
      );
    }

    // 4) Check if CMS fits in placeholder (excluding < and > brackets)
    const reservedSpace = contentsEnd - contentsStart - 2; // -2 for < and >
    console.log('Reserved space in placeholder:', reservedSpace);
    console.log('CMS hex length:', cmsHex.length);

    if (cmsHex.length > reservedSpace) {
      console.error(`CMS too large: ${cmsHex.length} > ${reservedSpace}`);
      throw new BadRequestException(
        `CMS hex length ${cmsHex.length} exceeds reserved space ${reservedSpace}`,
      );
    }

    // 5) Pad CMS with zeros to fill the placeholder exactly - CRITICAL: maintain exact length
    const paddedCMS = cmsHex.padEnd(reservedSpace, '0');
    console.log('Padded CMS length:', paddedCMS.length);
    console.log('Reserved space:', reservedSpace);
    console.log('Length match check:', paddedCMS.length === reservedSpace);

    // 6) Replace ONLY the Contents including < and >, do NOT touch ByteRange yet
    const beforeContents = pdfStr.substring(0, contentsStart);
    const afterContents = pdfStr.substring(contentsEnd);

    // Debug: Check content before replacement
    const originalContent = pdfStr.substring(contentsStart, contentsEnd);
    console.log('=== CMS REPLACEMENT DEBUG ===');
    console.log('Original content length:', originalContent.length);
    console.log(
      'Original content preview:',
      originalContent.substring(0, 50) + '...',
    );
    console.log('Padded CMS preview:', paddedCMS.substring(0, 50) + '...');

    // CRITICAL: Replacement MUST maintain exact same length
    const newContentsSection = '<' + paddedCMS + '>';
    console.log('Original contents section length:', originalContent.length);
    console.log('New contents section length:', newContentsSection.length);
    console.log(
      'Length preservation check:',
      originalContent.length === newContentsSection.length,
    );

    if (originalContent.length !== newContentsSection.length) {
      throw new BadRequestException(
        `CMS replacement length mismatch: original ${originalContent.length} vs new ${newContentsSection.length}`,
      );
    }

    const finalPdfStr = beforeContents + newContentsSection + afterContents;
    console.log('Replacement: <' + paddedCMS.substring(0, 20) + '...>');

    // Debug: Verify replacement worked
    const newContent = finalPdfStr.substring(
      contentsStart,
      contentsStart + originalContent.length,
    );
    console.log('New content preview:', newContent.substring(0, 50) + '...');
    console.log(
      'Replacement successful:',
      newContent.startsWith('<') && newContent.endsWith('>'),
    );
    console.log('=== CMS REPLACEMENT DEBUG END ===');

    console.log('Final PDF string length:', finalPdfStr.length);
    console.log('Length change:', finalPdfStr.length - pdfStr.length);

    const finalPdf = Buffer.from(finalPdfStr, 'latin1');

    // 7) **CRITICAL**: Calculate ByteRange AFTER CMS embedding for accurate positions
    console.log('\n=== CALCULATING BYTERANGE AFTER CMS EMBED ===');

    // Calculate ByteRange based on PDF specification with FINAL PDF positions:
    // [a b c d] means: signed data = bytes[a..a+b-1] + bytes[c..c+d-1]
    // Signature area (excluded) = bytes[a+b..c-1]
    const a = 0; // always start from beginning
    const b = contentsStart + 1; // up to and INCLUDING '<' (signature starts AFTER '<')
    const c = contentsEnd - 1; // from and INCLUDING '>' (signature ends BEFORE '>')
    const d = finalPdf.length - c; // remaining bytes from FINAL PDF (after CMS embedding)

    console.log('ByteRange calculation (AFTER CMS embed):');
    console.log(`  Final PDF length: ${finalPdf.length}`);
    console.log(`  Contents start: ${contentsStart} (position of '<')`);
    console.log(`  Contents end: ${contentsEnd} (position after '>')`);
    console.log(`  Calculated ByteRange: [${a}, ${b}, ${c}, ${d}]`);
    console.log(`  Signature area (excluded): bytes ${b} to ${c - 1}`);
    console.log(
      `  Signed data: bytes 0-${b - 1} + bytes ${c}-${finalPdf.length - 1}`,
    );

    // 8) Recalculate ALL ByteRanges after embedding CMS for multiple signature support
    console.log('Recalculating all ByteRanges after CMS embed...');
    const recalculatedPdf = this.recalculateAllByteRanges(finalPdf);

    // Debug: Check final PDF content around ByteRange positions
    console.log('\n=== FINAL PDF CONTENT ANALYSIS ===');
    const finalPdfString = recalculatedPdf.toString('latin1'); // CRITICAL: Use latin1 encoding!

    // Debug: Check actual bytes at the embedded position
    console.log('\n=== BYTE-LEVEL CMS VERIFICATION ===');
    const cmsDataStart = contentsStart + 1; // CMS data starts AFTER '<'
    console.log(
      'Checking bytes at position',
      cmsDataStart,
      'to',
      cmsDataStart + 20,
    );
    const bytesAtPosition = recalculatedPdf.subarray(
      cmsDataStart,
      cmsDataStart + 20,
    );
    console.log(
      'Hex bytes at embedded position:',
      bytesAtPosition.toString('hex').toUpperCase(),
    );
    console.log(
      'ASCII at embedded position:',
      bytesAtPosition.toString('ascii'),
    );

    // Check if it matches CMS start
    const expectedCmsStart = paddedCMS.substring(0, 40); // First 20 bytes = 40 hex chars
    console.log('Expected CMS start (first 40 hex chars):', expectedCmsStart);
    console.log(
      'Actual vs Expected match:',
      bytesAtPosition.toString('hex').toUpperCase() ===
        expectedCmsStart.toUpperCase(),
    );
    console.log('=== BYTE-LEVEL CMS VERIFICATION END ===\n');

    // Find all ByteRange entries in final PDF
    const byteRangeMatches = Array.from(
      finalPdfString.matchAll(
        /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g,
      ),
    );
    console.log('Found ByteRange entries:', byteRangeMatches.length);

    byteRangeMatches.forEach((match, idx) => {
      const [, a, b, c, d] = match;
      const byteRange = {
        a: parseInt(a),
        b: parseInt(b),
        c: parseInt(c),
        d: parseInt(d),
      };
      console.log(`ByteRange #${idx}:`, byteRange);

      // Check what's at those positions in FINAL PDF
      console.log(
        `  Final content at position ${byteRange.b}:`,
        JSON.stringify(finalPdfString.charAt(byteRange.b)),
      );
      console.log(
        `  Final content at position ${byteRange.c}:`,
        JSON.stringify(finalPdfString.charAt(byteRange.c)),
      );
      console.log(
        `  Final range preview at ${byteRange.b}: "${finalPdfString.substring(byteRange.b, byteRange.b + 10)}"`,
      );
      console.log(
        `  Final range preview at ${byteRange.c}: "${finalPdfString.substring(byteRange.c, byteRange.c + 10)}"`,
      );
    });

    // *** ByteRange calculation is now handled by recalculateAllByteRanges ***
    console.log('\n=== BYTERANGE ALREADY CALCULATED ===');
    console.log(
      'All ByteRanges have been recalculated by recalculateAllByteRanges method',
    );

    console.log('=== EMBED CMS DEBUG END ===\n');
    return recalculatedPdf;
  }

  // --- Helpers ---
  // Tìm phạm vi /Contents <...> và tính ByteRange đúng chuẩn
  private locateContentsGap(pdf: Buffer, signatureIndex = 0) {
    const pdfStr = pdf.toString('latin1'); // giữ nguyên byte

    // Tìm tất cả signature objects dựa vào /Contents pattern (không phụ thuộc ByteRange)
    const reSig = /\/Contents\s*<([0-9A-Fa-f]*)>/g;

    let m: RegExpExecArray | null;
    let found = 0;
    while ((m = reSig.exec(pdfStr))) {
      if (found === signatureIndex) {
        const fullMatch = m[0];
        const hexInside = m[1] ?? '';

        // Tìm vị trí chính xác của '<' và '>'
        const contentsStart = m.index + fullMatch.indexOf('/Contents');
        const ltPos = pdfStr.indexOf('<', contentsStart);
        const gtPos = pdfStr.indexOf('>', ltPos);

        if (ltPos < 0 || gtPos < 0) {
          throw new Error(
            `Cannot find <...> brackets for signature ${signatureIndex}`,
          );
        }

        const start = ltPos; // offset bắt đầu gap (tại '<')
        const hexLen = hexInside.length; // số ký tự hex giữa < >
        const gapLen = gtPos - ltPos + 1; // từ '<' đến '>' (inclusive)
        const end = gtPos + 1; // vị trí sau dấu '>' (c = end)

        return {
          start,
          end,
          gapLen,
          hexLen,
          ltPos,
          gtPos,
          byteRangeShouldBe: [0, start, end, pdf.length - end] as [
            number,
            number,
            number,
            number,
          ],
          hexInside,
        };
      }
      found++;
    }
    throw new Error(`Signature index ${signatureIndex} not found`);
  }

  // Đọc /ByteRange đã khai báo trong file ở signatureIndex
  private readDeclaredByteRange(pdf: Buffer, signatureIndex = 0) {
    const s = pdf.toString('latin1');
    const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(s))) {
      if (idx === signatureIndex) {
        const a = Number(m[1]),
          b = Number(m[2]),
          c = Number(m[3]),
          d = Number(m[4]);
        return { a, b, c, d, text: m[0], start: m.index, end: re.lastIndex };
      }
      idx++;
    }
    return null; // có thể là prepare chưa viết ByteRange
  }

  // Hash đúng chuẩn theo phạm vi gap đã xác định
  private hashForSignatureByGap(
    pdf: Buffer,
    gap: { start: number; end: number },
  ) {
    const md = crypto.createHash('sha256');
    if (gap.start > 0) md.update(pdf.subarray(0, gap.start));
    if (gap.end < pdf.length) md.update(pdf.subarray(gap.end));
    return { digestHex: md.digest('hex') };
  }

  public async getCertificates(options?: {
    userId?: string;
    serialNumber?: string; // nếu bạn đã biết serial (khuyến nghị truyền vào)
    serviceType?: 'ESEAL' | 'ESIGN'; // nếu biết loại dịch vụ, truyền vào để đỡ fallback
    transactionId?: string;
  }) {
    const user_id = (
      options?.userId ??
      this.smartca.smartcaUserId ??
      ''
    ).trim();
    const basePayload: any = {
      sp_id: this.smartca.smartcaSpId,
      sp_password: this.smartca.smartcaSpPassword,
      user_id,
      transaction_id: options?.transactionId || 'SP_CA_' + Date.now(),
      time_stamp: utcTimestamp(),
    };

    const attempt = async (extra?: Record<string, any>) => {
      const url = `${this.smartca.smartcaBaseUrl}${this.smartca.smartcaCertPath}`;
      const payload = { ...basePayload, ...(extra || {}) };
      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      });
      const raw = res.data ?? {};
      const list = raw?.data?.user_certificates ?? [];
      const certs = Array.isArray(list)
        ? list.map(this.normalizeCertItem.bind(this))
        : [];
      return {
        status: res.status,
        url,
        request: payload,
        response: raw,
        certificates: certs,
      };
    };

    // 1) Ưu tiên theo yêu cầu cụ thể của bạn (serial/service_type)
    const first = await attempt({
      ...(options?.serialNumber ? { serial_number: options.serialNumber } : {}),
      ...(options?.serviceType ? { service_type: options.serviceType } : {}),
    });
    if (first.status === 200 && first.certificates.length) return first;

    // 2) Nếu chưa có kết quả và bạn KHÔNG truyền serviceType: thử ESEAL → ESIGN
    if (!options?.serviceType) {
      const second = await attempt({
        service_type: 'ESEAL',
        ...(options?.serialNumber
          ? { serial_number: options.serialNumber }
          : {}),
      });
      if (second.status === 200 && second.certificates.length) return second;

      const third = await attempt({
        service_type: 'ESIGN',
        ...(options?.serialNumber
          ? { serial_number: options.serialNumber }
          : {}),
      });
      if (third.status === 200 && third.certificates.length) return third;
    }

    // 3) Không tìm thấy -> trả data để bạn debug
    return first;
  }

  private extractPemChainFromGetCertResp(certificates: any[]): {
    signerPem: string;
    chainPem: string[];
    serial: string;
  } {
    if (!Array.isArray(certificates) || !certificates.length) {
      throw new BadRequestException(
        'No certificates returned from get_certificate',
      );
    }
    const pick = this.pickActiveCert(certificates);
    const serial = pick.serial_number;
    if (!serial)
      throw new BadRequestException(
        'Missing serial_number in certificate item',
      );

    let signerPem: string | null = null;
    if (pick.cert_pem) signerPem = pick.cert_pem;
    else if (pick.cert_b64_der)
      signerPem = this.derBase64ToPem(pick.cert_b64_der);
    else
      throw new BadRequestException(
        'Missing certificate content (cert_data/certificate)',
      );

    if (!signerPem) {
      throw new BadRequestException('signerPem is null or undefined');
    }

    const chainPem: string[] = [];
    chainPem.push(...this.maybeToPem(pick.chain_obj?.ca_cert));
    chainPem.push(...this.maybeToPem(pick.chain_obj?.root_cert));

    return { signerPem, chainPem, serial };
  }

  private pickActiveCert(list: any[]) {
    const isActive = (c: any) => {
      const code = String(c.cert_status_code ?? '').toUpperCase();
      const text = String(c.cert_status ?? '').toUpperCase();
      return (
        code === 'VALID' ||
        text.includes('ĐANG HOẠT ĐỘNG') ||
        text.includes('ACTIVE')
      );
    };
    return list.find(isActive) || list[0];
  }

  private maybeToPem(input?: string | null): string[] {
    if (!input) return [];
    if (/-----BEGIN CERTIFICATE-----/.test(input)) return [input];
    try {
      return [this.derBase64ToPem(input)];
    } catch {
      return [];
    }
  }

  private derBase64ToPem(derB64: string, label = 'CERTIFICATE'): string {
    const clean = derB64.replace(/\s+/g, '');
    const b64 = Buffer.from(Buffer.from(clean, 'base64')).toString('base64');
    const chunk = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
    return `-----BEGIN ${label}-----\n${chunk}\n-----END ${label}-----\n`;
  }

  private normalizeCertItem(it: any) {
    const serial_number = it?.serial_number ?? null;
    const cert_b64_der =
      typeof it?.cert_data === 'string'
        ? it.cert_data.replace(/\s+/g, '')
        : null; // DER b64
    const cert_pem =
      typeof it?.certificate === 'string' ? it.certificate : null;
    const chain_obj = it?.chain_data ?? {}; // { ca_cert, root_cert }

    return {
      serial_number,
      cert_status_code: it?.cert_status_code ?? null,
      cert_status: it?.cert_status ?? null,
      cert_b64_der,
      cert_pem,
      chain_obj: {
        ca_cert: chain_obj?.ca_cert ?? null,
        root_cert: chain_obj?.root_cert ?? null,
      },
      _raw: it,
    };
  }

  private buildSignedAttrsDER(pdfDigestHex: string, signerPem: string): Buffer {
    const contentTypeOID = this.smartca.oidData;

    // Attribute constructors
    const makeAttr = (oid: string, valueAsn1: forge.asn1.Asn1) =>
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer(oid).getBytes(),
          ),
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.SET,
            true,
            [valueAsn1],
          ),
        ],
      );

    // 1) contentType = data
    const contentTypeAsn1 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OID,
      false,
      forge.asn1.oidToDer(contentTypeOID).getBytes(),
    );
    const attrContentType = makeAttr(
      this.smartca.oidContentType ?? '',
      contentTypeAsn1,
    );

    // 2) messageDigest = SHA-256(PDF ByteRange)
    const msgDigestBytes = forge.util.hexToBytes(pdfDigestHex);
    const messageDigestAsn1 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      msgDigestBytes,
    );
    const attrMessageDigest = makeAttr(
      this.smartca.oidMessageDigest ?? '',
      messageDigestAsn1,
    );

    // 3) signingTime = now (UTCTime nếu < 2050)
    const signingTimeAsn1 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.UTCTIME,
      false,
      forge.asn1.dateToUtcTime(new Date()),
    );
    const attrSigningTime = makeAttr(
      this.smartca.oidSigningTime ?? '',
      signingTimeAsn1,
    );

    // 4) signingCertificateV2 (ESSCertIDv2 với certHash SHA-256)
    const cert = forge.pki.certificateFromPem(signerPem);
    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(cert))
      .getBytes();
    const certHash = forge.md.sha256
      .create()
      .update(certDer)
      .digest()
      .getBytes();
    const essCertIDv2 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        // hash (OCTET STRING)
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OCTETSTRING,
          false,
          certHash,
        ),
        // algorithmIdentifier (OPTIONAL) — bỏ qua (mặc định sha256)
        // issuerSerial (OPTIONAL) — có thể bỏ qua, vẫn hợp lệ
      ],
    );
    const scv2Value = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [essCertIDv2],
    );
    const attrSigningCertV2 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(this.smartca.oidSigningCertV2).getBytes(),
        ),
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.SET,
          true,
          [scv2Value],
        ),
      ],
    );

    // === DER SORTING for SET OF Attribute ===
    const attrs = [
      attrContentType,
      attrMessageDigest,
      attrSigningTime,
      attrSigningCertV2,
    ];

    // Encode từng Attribute -> buffer để sort
    const encoded = attrs.map((a) => {
      const der = forge.asn1.toDer(a).getBytes();
      return { asn1: a, der: Buffer.from(der, 'binary') };
    });

    // Sort tăng dần theo byte DER (DER rule cho SET OF)
    encoded.sort((x, y) => x.der.compare(y.der));

    // Lấy lại danh sách ASN.1 theo thứ tự đã sort
    const sortedAsn1 = encoded.map((e) => e.asn1);

    // SET OF Attribute
    const signedAttrsSet = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      sortedAsn1,
    );

    // Xuất DER bytes
    const derBytes = forge.asn1.toDer(signedAttrsSet).getBytes();
    return Buffer.from(derBytes, 'binary');
  }

  /**
   * Gửi yêu cầu ký hash tới VNPT SmartCA.
   * data_to_be_signed = digestHex (lowercase, SHA-256)
   */
  public async requestSmartCASignByHash(options: {
    digestHex: string;
    digestBase64?: string;
    transactionId?: string | null;
    docId?: string | null;
    serialNumber?: string | null; // nếu không có sẽ gọi getCertificates để lấy
    userIdOverride?: string | null; // hiếm khi dùng, mặc định lấy env
    signType?: 'hash';
    fileType?: 'pdf';
  }) {
    const user_id = options.userIdOverride ?? this.smartca.smartcaUserId;
    if (
      !this.smartca.smartcaSpId ||
      !this.smartca.smartcaSpPassword ||
      !user_id
    ) {
      throw new BadRequestException(
        'Missing SmartCA credentials (SMARTCA_SP_ID, SMARTCA_SP_PASSWORD, SMARTCA_USER_ID)',
      );
    }

    // data_to_be_signed
    const dataToBeSigned = options.digestHex;

    const transaction_id =
      options.transactionId && options.transactionId.trim()
        ? options.transactionId.trim()
        : 'SP_CA_' + Date.now();

    const doc_id =
      options.docId && options.docId.trim()
        ? options.docId.trim()
        : 'doc-' + randomUUID();

    // lấy serial nếu thiếu
    let serial_number = options.serialNumber?.trim();
    if (!serial_number) {
      const certResp = await this.getCertificates({ userId: user_id });
      if (certResp.status !== 200) {
        throw new BadRequestException(
          `get_certificate failed (status ${certResp.status})`,
        );
      }
      serial_number = this.pickActiveSerial(
        certResp.certificates as SmartCAUserCertificate[],
      );
      if (!serial_number) {
        throw new BadRequestException(
          'No certificate/serial_number found for this user_id',
        );
      }
    }

    const payload: any = {
      sp_id: this.smartca.smartcaSpId,
      sp_password: this.smartca.smartcaSpPassword,
      user_id,
      transaction_id,
      transaction_desc: 'Sign PDF via API',
      time_stamp: utcTimestamp(),
      serial_number, // BẮT BUỘC theo thực tế VNPT
      sign_files: [
        {
          file_type: options.fileType ?? 'pdf',
          data_to_be_signed: dataToBeSigned,
          doc_id,
          sign_type: options.signType ?? 'hash',
          hash_alg: 'SHA-256',

          // ====== các flag yêu cầu CMS (ví dụ, chọn 1 trong các tên họ hỗ trợ) ======
          pkcs_type: 'p7_detached',
          signature_format: 'CADES_BES',
          return_type: 'pkcs7', // or "cms"
          need_pkcs7: true,
        },
      ],
    };

    const url = `${this.smartca.smartcaBaseUrl}${this.smartca.smartcaSignPath}`;
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });

    return {
      status: res.status,
      data: res.data,
      requestUrl: url,
      requestBody: payload,
    };
  }

  // === Helper: chọn serial đang active ===
  private pickActiveSerial(
    certs: SmartCAUserCertificate[],
  ): string | undefined {
    // Ưu tiên: VALID + (cert_status chứa "Đang hoạt động" hoặc "ACTIVE")
    const isActive = (c: SmartCAUserCertificate) => {
      const code = (c.cert_status_code ?? '').toUpperCase();
      const text = (c.cert_status ?? '').toUpperCase();
      return (
        code === 'VALID' ||
        text.includes('ĐANG HOẠT ĐỘNG'.toUpperCase()) ||
        text.includes('ACTIVE')
      );
    };
    const firstActive = certs.find((c) => c.serial_number && isActive(c));
    return (
      firstActive?.serial_number ??
      certs.find((c) => c.serial_number)?.serial_number
    );
  }

  /**
   * Poll trạng thái ký tới khi có kết quả / lỗi / timeout.
   * Trả về:
   *  - done: true/false
   *  - raw: response cuối
   *  - signatureValueBase64?: chuỗi chữ ký raw (nếu có)
   *  - error?: 'expired' | 'user_denied' | 'timeout' | 'error_4xx/5xx'
   */
  public async pollSmartCASignResult(opts: {
    transactionId: string;
    intervalMs?: number;
    timeoutMs?: number;
  }) {
    const intervalMs = opts.intervalMs ?? 2000;
    const timeoutMs = opts.timeoutMs ?? 120000;
    const startedAt = Date.now();

    while (true) {
      const r = await this.requestSmartCASignStatus(opts.transactionId);

      const body = r.data ?? {};
      const code = body.status_code ?? r.status;
      const msg = String(body.message ?? '').toLowerCase();
      const data = body.data ?? {};

      const sigDirect = data.signature_value;
      const sigArray = Array.isArray(data.signatures)
        ? data.signatures[0]?.signature_value
        : undefined;
      const signatureValueBase64 = sigDirect || sigArray || null;

      if (code === 200 && signatureValueBase64) {
        return { done: true, signatureValueBase64, raw: r };
      }

      if (msg.includes('wait_for_user') || msg.includes('pending')) {
        // tiếp tục chờ
      } else if (msg.includes('expire')) {
        return { done: true, error: 'expired', raw: r };
      } else if (msg.includes('deny') || msg.includes('reject')) {
        return { done: true, error: 'user_denied', raw: r };
      } else if ((r.status ?? 0) >= 400 && (r.status ?? 0) !== 409) {
        // ← đây là nơi bạn thấy error_405 trước đó
        return { done: true, error: `error_${r.status}`, raw: r };
      }

      if (Date.now() - startedAt > timeoutMs) {
        return { done: true, error: 'timeout', raw: r };
      }
      await new Promise((res) => setTimeout(res, intervalMs));
    }
  }

  /**
   * Gọi 1 lần tới endpoint trạng thái ký:
   * GET {BASE}{/signatures/sign/{tranId}/status}
   * Trả về nguyên status + body để bạn tự xử lý.
   */
  public async requestSmartCASignStatus(transactionId: string) {
    if (!transactionId?.trim()) {
      throw new Error('transactionId is required');
    }
    const url = `${this.smartca.smartcaBaseUrl}${(this.smartca.smartcaSignStatusTmpl ?? '').replace('{tranId}', encodeURIComponent(transactionId))}`;
    const res = await axios.post(url, undefined, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });
    return { status: res.status, data: res.data, requestUrl: url };
  }

  private buildDetachedCMSBase64(
    signedAttrsDER: Buffer, // DER của SignedAttributes (SET OF Attribute) đã chuẩn
    signatureValueBase64: string, // raw RSA signature (base64) do VNPT trả
    signerPem: string, // end-entity certificate PEM
    chainPem: string[], // CA/Root PEM (optional)
  ): string {
    const signerCert = forge.pki.certificateFromPem(signerPem);
    const signerCertAsn1 = forge.pki.certificateToAsn1(signerCert);
    const chainAsn1: forge.asn1.Asn1[] = [];
    for (const pem of chainPem || []) {
      try {
        chainAsn1.push(
          forge.pki.certificateToAsn1(forge.pki.certificateFromPem(pem)),
        );
      } catch {
        // Ignore conversion errors
      }
    }

    // AlgorithmIdentifier helpers
    const algId = (oid: string) =>
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer(oid).getBytes(),
          ),
          // rsaEncryption thường kèm NULL params
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.NULL,
            false,
            '',
          ),
        ],
      );

    const algIdNoParam = (oid: string) =>
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer(oid).getBytes(),
          ),
        ],
      );

    // Name (issuer) & serial từ certificate
    const issuerAsn1 = forge.pki.distinguishedNameToAsn1(signerCert.issuer);
    const serialAsn1 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      forge.util.hexToBytes(signerCert.serialNumber),
    );

    // sid = IssuerAndSerialNumber
    const sidAsn1 = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [issuerAsn1, serialAsn1],
    );

    // signedAttrs: [0] IMPLICIT (SET OF Attribute)  — dùng DER đã có để đảm bảo ordering
    const signedAttrsAsAsn1 = forge.asn1.fromDer(
      signedAttrsDER.toString('binary'),
    );
    const signedAttrsTagged = forge.asn1.create(
      forge.asn1.Class.CONTEXT_SPECIFIC,
      0,
      true,
      signedAttrsAsAsn1.value,
    );

    // SignerInfo (version=1 khi dùng IssuerAndSerialNumber)
    const signerInfo = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.INTEGER,
          false,
          forge.util.hexToBytes('01'),
        ), // version = 1
        sidAsn1, // sid
        algIdNoParam(OID_SHA256), // digestAlgorithm (sha256, KHÔNG param)
        signedAttrsTagged, // [0] signedAttrs
        algId(OID_RSA), // signatureAlgorithm (rsaEncryption + NULL)
        forge.asn1.create(
          // signature (OCTET STRING)
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OCTETSTRING,
          false,
          forge.util.decode64(signatureValueBase64),
        ),
        // unsignedAttrs (optional) — bỏ qua
      ],
    );

    // digestAlgorithms: SET OF { sha256 }
    const digestAlgorithms = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      [algIdNoParam(OID_SHA256)],
    );

    // encapContentInfo: data, detached (không eContent)
    const encapContentInfo = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(this.smartca.oidData).getBytes(),
        ),
        // [0] eContent omitted (detached)
      ],
    );

    // certificates: [0] IMPLICIT CertificateSet (include signer + chain)
    const certificatesTagged = forge.asn1.create(
      forge.asn1.Class.CONTEXT_SPECIFIC,
      0,
      true,
      [signerCertAsn1, ...chainAsn1],
    );

    // signerInfos: SET OF SignerInfo (1 signer)
    const signerInfos = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      [signerInfo],
    );

    // SignedData
    const signedData = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.INTEGER,
          false,
          forge.util.hexToBytes('01'),
        ), // version=1
        digestAlgorithms,
        encapContentInfo,
        certificatesTagged, // [0] certificates
        // crls [1] — optional, bỏ qua
        signerInfos,
      ],
    );

    // ContentInfo: { contentType: signedData, content [0] EXPLICIT SignedData }
    const contentInfo = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(this.smartca.oidSignedData).getBytes(),
        ),
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
          signedData,
        ]),
      ],
    );

    const derBytes = forge.asn1.toDer(contentInfo).getBytes();
    return forge.util.encode64(derBytes); // ← CMS (PKCS#7) base64 để đưa cho /embed-cms
  }

  /**
   * Recalculate all ByteRange entries in a PDF after structural changes
   * This is critical for multiple signatures to work correctly
   */
  private recalculateAllByteRanges(pdf: Buffer): Buffer {
    console.log('\n=== RECALCULATING ALL BYTERANGES ===');

    const pdfStr = pdf.toString('latin1');
    console.log('PDF length for recalculation:', pdf.length);

    // Find all signature objects with /Contents placeholders
    const signatureObjects: Array<{
      signatureIndex: number;
      contentsStart: number;
      contentsEnd: number;
      byteRangePosition: number;
      currentByteRange: string;
    }> = [];

    // Find all /Contents entries (signature placeholders)
    const contentsRegex = /\/Contents\s*<([0-9A-Fa-f]*)>/g;
    let contentsMatch: RegExpExecArray | null;
    let signatureIndex = 0;

    while ((contentsMatch = contentsRegex.exec(pdfStr)) !== null) {
      const contentsStart = contentsMatch.index + contentsMatch[0].indexOf('<');
      const contentsEnd =
        contentsStart + contentsMatch[0].length - contentsMatch[0].indexOf('<');

      console.log(`\nFound signature #${signatureIndex}:`);
      console.log(`  Contents start: ${contentsStart}`);
      console.log(`  Contents end: ${contentsEnd}`);

      // Find corresponding ByteRange for this signature
      // Look backwards from the /Contents to find the /ByteRange
      const beforeContents = pdfStr.substring(0, contentsMatch.index);
      const byteRangeMatch = beforeContents.match(
        /\/ByteRange\s*\[([^\]]+)\]/g,
      );

      if (byteRangeMatch && byteRangeMatch.length > 0) {
        // Get the last ByteRange match (closest to this /Contents)
        const lastByteRangeMatch = byteRangeMatch[byteRangeMatch.length - 1];
        const byteRangePosition =
          beforeContents.lastIndexOf(lastByteRangeMatch);

        signatureObjects.push({
          signatureIndex,
          contentsStart,
          contentsEnd,
          byteRangePosition,
          currentByteRange: lastByteRangeMatch,
        });

        console.log(`  Found ByteRange at position: ${byteRangePosition}`);
        console.log(`  Current ByteRange: ${lastByteRangeMatch}`);
      } else {
        console.log(
          `  Warning: No ByteRange found for signature #${signatureIndex}`,
        );
      }

      signatureIndex++;
    }

    console.log(`\nTotal signatures found: ${signatureObjects.length}`);

    // Recalculate ByteRange for each signature
    let updatedPdfStr = pdfStr;
    let totalLengthChange = 0;

    for (const sigObj of signatureObjects) {
      // Adjust positions based on previous changes
      const adjustedContentsStart = sigObj.contentsStart + totalLengthChange;
      const adjustedContentsEnd = sigObj.contentsEnd + totalLengthChange;
      const adjustedByteRangePosition =
        sigObj.byteRangePosition + totalLengthChange;

      console.log(
        `\nRecalculating ByteRange for signature #${sigObj.signatureIndex}:`,
      );
      console.log(`  Adjusted contents start: ${adjustedContentsStart}`);
      console.log(`  Adjusted contents end: ${adjustedContentsEnd}`);

      // Calculate new ByteRange values
      const a = 0; // Always start from beginning
      const b = adjustedContentsStart + 1; // Up to and including '<'
      const c = adjustedContentsEnd - 1; // From and including '>'
      const d = Buffer.from(updatedPdfStr, 'latin1').length - c; // Remaining bytes

      console.log(`  New ByteRange: [${a}, ${b}, ${c}, ${d}]`);

      // Create new ByteRange string
      const newByteRangeContent = `${a} ${b} ${c} ${d}`;
      const newByteRangeStr = `/ByteRange [${newByteRangeContent}]`;

      // Find the exact ByteRange to replace
      const currentByteRangeRegex = /\/ByteRange\s*\[[^\]]+\]/;
      const byteRangeStartIndex = adjustedByteRangePosition;
      const searchArea = updatedPdfStr.substring(
        byteRangeStartIndex,
        byteRangeStartIndex + 200,
      );
      const localMatch = searchArea.match(currentByteRangeRegex);

      if (localMatch) {
        const actualByteRangeStart = byteRangeStartIndex + localMatch.index!;
        const actualByteRangeEnd = actualByteRangeStart + localMatch[0].length;
        const oldByteRangeStr = localMatch[0];

        console.log(`  Old ByteRange: "${oldByteRangeStr}"`);
        console.log(`  New ByteRange: "${newByteRangeStr}"`);

        // Replace the ByteRange
        const beforeByteRange = updatedPdfStr.substring(
          0,
          actualByteRangeStart,
        );
        const afterByteRange = updatedPdfStr.substring(actualByteRangeEnd);
        updatedPdfStr = beforeByteRange + newByteRangeStr + afterByteRange;

        const lengthChange = newByteRangeStr.length - oldByteRangeStr.length;
        totalLengthChange += lengthChange;

        console.log(
          `  Length change: ${lengthChange} (total: ${totalLengthChange})`,
        );
        console.log(`  ByteRange updated successfully`);
      } else {
        console.log(
          `  Error: Could not find ByteRange to replace at position ${adjustedByteRangePosition}`,
        );
      }
    }

    console.log('\n=== BYTERANGE RECALCULATION COMPLETE ===');
    console.log(
      `Final PDF length: ${Buffer.from(updatedPdfStr, 'latin1').length}`,
    );
    console.log(`Total length change: ${totalLengthChange}`);

    return Buffer.from(updatedPdfStr, 'latin1');
  }
}
