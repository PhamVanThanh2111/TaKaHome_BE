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

type Gap = {
  start: number; // absolute index of '<'  (excluded region start)
  end: number; // absolute index of '>' + 1 (excluded region end)
  lt: number; // index of '<'
  gt: number; // index of '>'
  innerRawLen: number; // bytes inside <...> including whitespace
  innerHexLen: number; // hex length without whitespace
  byteRangeShouldBe: [number, number, number, number];
};

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

    // 1) Xác định khoảng bị loại trừ <...> theo /Contents (độc lập ByteRange)
    const gap = this.locateContentsGap(options.pdf, signatureIndex);
    const b = gap.start; // vị trí '<'
    const c = gap.end; // ngay sau '>'
    const d = options.pdf.length - c; // phần đuôi
    console.log('[sign-to-cms]', {
      idx: signatureIndex,
      fileSize: options.pdf.length,
      lt: gap.start,
      gtPlus1: gap.end,
      excludedLen: gap.end - gap.start,
      innerRawLen: gap.innerRawLen,
      innerHexLen: gap.innerHexLen,
      byteRangeShouldBe: [0, b, c, d],
    });

    // 2) Xác định CHUỖI /ByteRange [...] đúng của chính từ điển chữ ký này
    const s0 = options.pdf.toString('latin1');

    // Tìm đúng match /Contents thứ signatureIndex để suy ra ranh giới dictionary
    const reContents = /\/Contents\s*<([\s\S]*?)>/g;
    const contentsMatches = Array.from(s0.matchAll(reContents));
    if (signatureIndex < 0 || signatureIndex >= contentsMatches.length) {
      throw new BadRequestException(
        `Cannot find /Contents for signature index ${signatureIndex}`,
      );
    }
    const m = contentsMatches[signatureIndex];
    const full = m[0];
    const before = s0.slice(0, m.index!);
    const ltPos = before.length + full.indexOf('<');
    const gtPos = before.length + full.lastIndexOf('>');

    const dictStart = s0.lastIndexOf('<<', m.index!);
    const dictEnd = s0.indexOf('>>', gtPos);
    if (dictStart < 0 || dictEnd < 0 || dictEnd <= dictStart) {
      throw new BadRequestException(
        'Cannot locate signature dictionary in signToCmsPades',
      );
    }
    const dictStr = s0.slice(dictStart, dictEnd + 2);
    const relBR = dictStr.match(/\/ByteRange\s*\[([^\]]+)\]/);
    if (!relBR || relBR.index == null) {
      throw new BadRequestException(
        'ByteRange not found inside signature dictionary in signToCmsPades',
      );
    }
    const oldBR = relBR[0];
    const brAbsStart = dictStart + relBR.index!;
    const brAbsEnd = brAbsStart + oldBR.length;

    // 3) Tạo chuỗi ByteRange số thật [0 b c d] và PAD cho đúng độ dài placeholder
    let newBR = `/ByteRange [0 ${b} ${c} ${d}]`;
    if (newBR.length > oldBR.length) {
      throw new BadRequestException(
        `new /ByteRange longer than placeholder by ${newBR.length - oldBR.length} bytes`,
      );
    }
    if (newBR.length < oldBR.length) {
      newBR =
        newBR.slice(0, -1) + ' '.repeat(oldBR.length - newBR.length) + ']';
    }

    // 4) Tạo BẢN SAO "đúng ByteRange" để băm (KHÔNG đụng options.pdf gốc)
    const simulated = Buffer.from(
      s0.slice(0, brAbsStart) + newBR + s0.slice(brAbsEnd),
      'latin1',
    );

    // Sentinel: bắt buộc tại b là '<' và tại c-1 là '>'
    if (simulated[b] !== 0x3c || simulated[c - 1] !== 0x3e) {
      throw new BadRequestException('sign-to-cms: not "<...>" at [b..c-1]');
    }

    // 5) Hash PAdES: SHA-256( simulated[0..b) || simulated[c..EOF] )
    const h = crypto.createHash('sha256');
    h.update(simulated.subarray(0, b));
    h.update(simulated.subarray(c));
    const pdfDigestHex = h.digest('hex');
    console.log('[sign-to-cms/digestAfterBR]', pdfDigestHex, {
      idx: signatureIndex,
      b,
      c,
      d,
      fileSize: options.pdf.length,
    });

    // 6) Lấy cert & serial (GIỮ NGUYÊN logic cũ của bạn)
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

    // 7) Build SignedAttributes DER từ pdfDigestHex (GIỮ NGUYÊN)
    const signedAttrsDER = this.buildSignedAttrsDER(pdfDigestHex, signerPem);

    // 8) Hash DER (SHA-256) → gửi ký SmartCA (GIỮ NGUYÊN)
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

    // 9) Poll tới khi có signature_value (GIỮ NGUYÊN)
    const poll = await this.pollSmartCASignResult({
      transactionId,
      intervalMs: options.intervalMs ?? 2000,
      timeoutMs: options.timeoutMs ?? 180000,
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

    // 10) Lắp CMS detached (Base64) (GIỮ NGUYÊN)
    const cmsBase64 = this.buildDetachedCMSBase64(
      signedAttrsDER,
      sig,
      signerPem,
      chainPem,
    );

    // 11) Trả về đúng shape cũ (GIỮ NGUYÊN)
    return {
      cmsBase64,
      transactionId,
      docId,
      signatureIndex,
      byteRange: gap, // [0,b,c,d] từ locateContentsGap
      pdfLength: options.pdf.length,
      digestHex: pdfDigestHex, // hash khớp tuyệt đối với verify sau embed
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
    // 0) Normalize CMS -> HEX UPPER
    let cmsHex = (cmsBase64OrHex || '').trim();
    const looksHex =
      /^[0-9A-Fa-f\s]+$/.test(cmsHex) &&
      cmsHex.replace(/\s+/g, '').length % 2 === 0;
    if (!looksHex) cmsHex = Buffer.from(cmsHex, 'base64').toString('hex');
    cmsHex = cmsHex.replace(/\s+/g, '').toUpperCase();

    let work = Buffer.from(pdf);
    const s0 = work.toString('latin1');

    // 1) Locate the /Contents <...> placeholder by index
    const reContents = /\/Contents\s*<([\s\S]*?)>/g;
    const hits = Array.from(s0.matchAll(reContents));
    if (signatureIndex < 0 || signatureIndex >= hits.length) {
      throw new BadRequestException(
        `Cannot find /Contents for signature index ${signatureIndex}`,
      );
    }
    const m = hits[signatureIndex];
    const full = m[0];
    const before = s0.slice(0, m.index!);
    const ltPos = before.length + full.indexOf('<'); // '<'
    const gtPos = before.length + full.lastIndexOf('>'); // '>'

    const reservedHex = (m[1] || '').replace(/\s+/g, '');
    const reservedLen = reservedHex.length;
    if (cmsHex.length > reservedLen) {
      throw new BadRequestException(
        `CMS hex length ${cmsHex.length} exceeds reserved ${reservedLen}`,
      );
    }

    // DEBUG
    // eslint-disable-next-line no-console
    console.log('[embed-cms/before]', {
      idx: signatureIndex,
      fileSize: work.length,
      ltPos,
      gtPos,
      reservedLen,
      cmsLen: cmsHex.length,
      aroundLT: work
        .subarray(Math.max(0, ltPos - 8), Math.min(work.length, ltPos + 2))
        .toString('latin1'),
      aroundGT: work
        .subarray(Math.max(0, gtPos - 1), Math.min(work.length, gtPos + 8))
        .toString('latin1'),
    });

    // 2) Put CMS hex in-place BETWEEN < >
    const padded = cmsHex.padEnd(reservedLen, '0');
    const beforeContents = work.subarray(0, ltPos + 1); // includes '<'
    const afterContents = work.subarray(gtPos); // starts at '>' (includes '>')
    work = Buffer.concat([
      beforeContents,
      Buffer.from(padded, 'ascii'),
      afterContents,
    ]);

    // 3) Exclusion by convention: EXCLUDE the whole <...>
    const a = 0;
    const b = ltPos; // at '<'
    const c = gtPos + 1; // after '>'
    const d = work.length - c;

    // 4) Sync with locateContentsGap + size invariant
    const expect = this.locateContentsGap(work, signatureIndex);
    if (expect.start !== b || expect.end !== c) {
      throw new BadRequestException('ByteRange mismatch with expected gap');
    }
    if (b + (c - b) + d !== work.length) {
      throw new BadRequestException('ByteRange sums do not match file size');
    }

    // 5) Write /ByteRange INSIDE the signature dictionary (not by global index)
    work = this.writeByteRangeInSigDict(work, signatureIndex, [a, b, c, d]);

    // ========= VERIFY BLOCK (1): read /ByteRange back from file =========
    const got = this.readByteRangeInSigDict(work, signatureIndex);
    if (!got.length) {
      throw new BadRequestException(
        'Post-embed: no /ByteRange found in signature dictionary',
      );
    }
    if (got[0] !== a || got[1] !== b || got[2] !== c || got[3] !== d) {
      throw new BadRequestException(
        `Post-embed /ByteRange mismatch: wrote [${a} ${b} ${c} ${d}] but file has [${got.join(' ')}]`,
      );
    }
    console.log('[verify/byteRange-exact]', { got, expect: [a, b, c, d] });

    // ========= VERIFY BLOCK (2): check sentinel bytes at b and c-1 =========
    const byteAtB = work[b];
    const byteAtCm1 = work[c - 1];
    console.log('[verify/sentinels]', {
      b,
      c,
      byteAtB,
      charB: String.fromCharCode(byteAtB),
      byteAtCm1,
      charCm1: String.fromCharCode(byteAtCm1),
    });
    if (byteAtB !== 0x3c || byteAtCm1 !== 0x3e) {
      // '<' and '>'
      throw new BadRequestException(
        'Sentinel bytes mismatch: not < ... > at [b .. c-1]',
      );
    }

    // ========= VERIFY BLOCK (3): recompute digest over two ranges =========
    const digestHexAfterEmbed = this.hashTwoRanges(work, b, c);
    // eslint-disable-next-line no-console
    console.log('[verify/digestAfterEmbed]', digestHexAfterEmbed);

    // Done
    return work;
  }

  // --- Helpers ---

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

  public debugScanSignatures(pdf: Buffer) {
    const s = pdf.toString('latin1');
    const list: any[] = [];
    const reContents = /\/Contents\s*<([\s\S]*?)>/g;

    for (const m of s.matchAll(reContents)) {
      const idx = list.length;
      const full = m[0];
      const before = s.slice(0, m.index!);
      const lt = before.length + full.indexOf('<');
      const gt = before.length + full.lastIndexOf('>');

      const dictStart = s.lastIndexOf('<<', m.index!);
      const dictEnd = s.indexOf('>>', gt);
      const dictStr =
        dictStart >= 0 && dictEnd > dictStart
          ? s.slice(dictStart, dictEnd + 2)
          : '';

      const relBR = dictStr.match(/\/ByteRange\s*\[([^\]]+)\]/);
      const brNums = relBR ? relBR[1].trim().split(/\s+/).map(Number) : null;

      list.push({
        idx,
        lt,
        gt,
        hasDict: dictStart >= 0 && dictEnd > dictStart,
        hasBR: !!relBR,
        brNums,
        dictPreview: dictStr.slice(0, 160),
      });
    }

    // eslint-disable-next-line no-console
    console.log('[scan]', list);
    return list;
  }

  /** Step 1: build digest for remote signing (SmartCA). */
  public signToCmsBuildDigest(pdf: Buffer, signatureIndex: number) {
    // 1) Xác định gap EXCLUDE cả '<'…'>'
    const gap = this.locateContentsGap(pdf, signatureIndex);
    const [a, b, c, d] = gap.byteRangeShouldBe; // = [0, b, c, fileLen - c]

    // 2) Tạo BẢN COPY và GHI /ByteRange NGAY BÂY GIỜ
    let work = Buffer.from(pdf);
    work = this.writeByteRangeInSigDict(work, signatureIndex, [a, b, c, d]);

    // 3) VERIFY nhanh trên bản copy (để bắt lỗi sớm)
    const got = this.readByteRangeInSigDict(work, signatureIndex);
    if (
      !got.length ||
      got[0] !== a ||
      got[1] !== b ||
      got[2] !== c ||
      got[3] !== d
    ) {
      throw new BadRequestException(
        `sign-to-cms: /ByteRange not set as expected`,
      );
    }
    if (work[b] !== 0x3c || work[c - 1] !== 0x3e) {
      // '<' và '>'
      throw new BadRequestException(`sign-to-cms: not <...> at [b..c-1]`);
    }

    // 4) BĂM trên bản copy đã có /ByteRange đúng
    const mdHex = this.hashTwoRanges(work, b, c);
    console.log('[sign-to-cms/digestAfterBR]', mdHex);

    // 5) Trả digest để gửi SmartCA ký
    const digest = Buffer.from(mdHex, 'hex'); // tuỳ SDK bạn cần Buffer hay hex
    return { digest, digestHex: mdHex };
  }

  private locateContentsGap(pdf: Buffer, signatureIndex = 0): Gap {
    const s = pdf.toString('latin1');

    // allow all whitespace inside HEX
    const re = /\/Contents\s*<([\s\S]*?)>/g;
    const matches = Array.from(s.matchAll(re));
    if (signatureIndex < 0 || signatureIndex >= matches.length) {
      throw new BadRequestException(
        `Cannot find /Contents for signature index ${signatureIndex}`,
      );
    }

    const m = matches[signatureIndex];
    const full = m[0];
    const before = s.slice(0, m.index!);

    const lt = before.length + full.indexOf('<'); // index of '<'
    const gt = before.length + full.lastIndexOf('>'); // index of '>'
    if (lt < 0 || gt < 0 || gt <= lt) {
      throw new BadRequestException('Malformed /Contents <...>');
    }

    const innerRaw = m[1]; // may include \r\n/space
    const innerRawLen = innerRaw.length;
    const innerHex = innerRaw.replace(/\s+/g, '');
    const innerHexLen = innerHex.length;

    if (
      innerHexLen === 0 ||
      innerHexLen % 2 !== 0 ||
      /[^0-9A-Fa-f]/.test(innerHex)
    ) {
      throw new BadRequestException('Invalid hex in /Contents');
    }

    // Exclude the whole token `<...>`
    const start = lt; // at '<'
    const end = gt + 1; // after '>'

    const excludedLen = end - start;
    // Must equal raw `<...>` bytes length: innerRawLen + 2 (two sentinels)
    if (excludedLen !== innerRawLen + 2) {
      throw new BadRequestException(
        'Excluded range length != raw length (+2) in /Contents',
      );
    }

    return {
      start,
      end,
      lt,
      gt,
      innerRawLen,
      innerHexLen,
      byteRangeShouldBe: [0, start, end, pdf.length - end],
    };
  }

  /** Hash 2 segments: [0..start) + [end..EOF] (exclude the whole `<...>`) */
  private hashForSignatureByGap(pdf: Buffer, gap: Gap) {
    const md = crypto.createHash('sha256');
    md.update(pdf.subarray(0, gap.start)); // trước '<'
    md.update(pdf.subarray(gap.end)); // sau '>'
    const digest = md.digest();
    return { digest, digestHex: Buffer.from(digest).toString('hex') };
  }

  /** Re-hash two ranges (used for post-embed verification). */
  private hashTwoRanges(buf: Buffer, b: number, c: number): string {
    const md = crypto.createHash('sha256');
    md.update(buf.subarray(0, b));
    md.update(buf.subarray(c));
    return md.digest('hex');
  }

  /** Đọc /ByteRange ngay TRONG từ điển chữ ký theo index */
  private readByteRangeInSigDict(
    pdf: Buffer,
    signatureIndex: number,
  ): number[] {
    const s = pdf.toString('latin1');
    const reCont = /\/Contents\s*<([\s\S]*?)>/g;
    const hits = Array.from(s.matchAll(reCont));
    if (signatureIndex < 0 || signatureIndex >= hits.length) {
      throw new BadRequestException(
        `Cannot find /Contents for index ${signatureIndex}`,
      );
    }
    const m = hits[signatureIndex];
    const dictStart = s.lastIndexOf('<<', m.index!);
    const dictEnd = s.indexOf('>>', s.indexOf('>', m.index!));
    if (dictStart < 0 || dictEnd < 0 || dictEnd <= dictStart) {
      throw new BadRequestException('Cannot locate signature dictionary');
    }
    const dictStr = s.slice(dictStart, dictEnd + 2);
    const br = dictStr.match(/\/ByteRange\s*\[([^\]]+)\]/);
    if (!br || br.index == null) return [];
    const nums = br[1].trim().split(/\s+/).map(Number);
    if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) return [];
    return nums;
  }

  /** Ghi /ByteRange mới vào CHÍNH từ điển chữ ký (giữ nguyên độ dài placeholder) */
  private writeByteRangeInSigDict(
    pdf: Buffer,
    signatureIndex: number,
    arr: [number, number, number, number],
  ): Buffer {
    const s = pdf.toString('latin1');
    const reCont = /\/Contents\s*<([\s\S]*?)>/g;
    const hits = Array.from(s.matchAll(reCont));
    const m = hits[signatureIndex];
    const dictStart = s.lastIndexOf('<<', m.index!);
    const dictEnd = s.indexOf('>>', s.indexOf('>', m.index!));
    if (dictStart < 0 || dictEnd < 0 || dictEnd <= dictStart) {
      throw new BadRequestException('Cannot locate signature dictionary');
    }
    const dictStr = s.slice(dictStart, dictEnd + 2);

    const relBR = dictStr.match(/\/ByteRange\s*\[([^\]]+)\]/);
    if (!relBR || relBR.index == null) {
      throw new BadRequestException('ByteRange not found in dict');
    }
    const oldBR = relBR[0];
    let newBR = `/ByteRange [${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]}]`;
    if (newBR.length > oldBR.length) {
      throw new BadRequestException(
        `new /ByteRange longer than placeholder by ${newBR.length - oldBR.length}`,
      );
    }
    if (newBR.length < oldBR.length) {
      newBR =
        newBR.slice(0, -1) + ' '.repeat(oldBR.length - newBR.length) + ']';
    }

    const absStart = dictStart + relBR.index!;
    const absEnd = absStart + oldBR.length;
    return Buffer.from(
      s.slice(0, absStart) + newBR + s.slice(absEnd),
      'latin1',
    );
  }
}
