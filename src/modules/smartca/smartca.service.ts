import { BadRequestException, Injectable } from '@nestjs/common';

type PlainAddPlaceholderInput = Parameters<typeof plainAddPlaceholder>[0] & {
  rect?: [number, number, number, number];
  page?: number;
  signatureLength?: number;
};

type Place = {
  page?: number;
  rect?: [number, number, number, number];
  signatureLength?: number;
  name?: string;
  reason?: string;
  contactInfo?: string;
  location?: string;
};

type PrepareOptions = Place | { places: Place[] };

const OID_SHA256 = forge.pki.oids.sha256;
const OID_RSA = forge.pki.oids.rsaEncryption;

const BR_SLOT_WIDTH = 12;
const MIN_SPACES_BETWEEN = 1;

export type SmartCASignResponse = any;

// time_stamp: YYYYMMDDhhmmssZ (UTC, không có 'T')
function utcTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export interface SmartCAUserCertificate {
  serial_number?: string;
  cert_status_code?: string; // "VALID" ...
  cert_status?: string; // "Đang hoạt động" ...
  [k: string]: any;
}
export interface SmartCAGetCertResp {
  message?: string;
  data?: { user_certificates?: SmartCAUserCertificate[] };
}

@Injectable()
export class SmartCAService {
  constructor() {}

  async preparePlaceholder(
    pdfBuffer: Buffer,
    options: PrepareOptions,
  ): Promise<Buffer> {
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
}
