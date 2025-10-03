import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMonths as addMonthsFn } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { randomUUID } from 'crypto';
import axios from 'axios';
import smartcaConfig from 'src/config/smartca.config';
import { ConfigType } from '@nestjs/config';

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
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,

    @Inject(smartcaConfig.KEY)
    private readonly smartca: ConfigType<typeof smartcaConfig>,
  ) {}

  async create(
    createContractDto: CreateContractDto,
  ): Promise<ResponseCommon<Contract>> {
    const contract = this.contractRepository.create(
      this.buildContractPayload(createContractDto),
    );
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Contract[]>> {
    const contracts = await this.contractRepository.find({
      relations: ['tenant', 'landlord', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', contracts);
  }

  async findOne(id: string): Promise<ResponseCommon<Contract | null>> {
    const contract = await this.findRawById(id);
    return new ResponseCommon(200, 'SUCCESS', contract);
  }

  async findByTenant(tenantId: string): Promise<ResponseCommon<Contract[]>> {
    const contracts = await this.contractRepository.find({
      where: { tenant: { id: tenantId } },
      relations: ['tenant', 'landlord', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', contracts);
  }

  async findByLandlord(
    landlordId: string,
  ): Promise<ResponseCommon<Contract[]>> {
    const contracts = await this.contractRepository.find({
      where: { landlord: { id: landlordId } },
      relations: ['tenant', 'landlord', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', contracts);
  }

  async findLatestByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<Contract | null> {
    const [contract] = await this.contractRepository.find({
      where: {
        tenant: { id: tenantId },
        property: { id: propertyId },
      },
      order: { createdAt: 'DESC' },
      relations: ['tenant', 'landlord', 'property'],
      take: 1,
    });
    return contract ?? null;
  }

  async createDraftForBooking(input: {
    tenantId: string;
    landlordId: string;
    propertyId: string;
    startDate?: Date;
    endDate?: Date;
    contractCode?: string;
    contractFileUrl?: string;
  }): Promise<Contract> {
    const start = input.startDate ? this.toDate(input.startDate) : vnNow();
    const proposedEnd = input.endDate
      ? this.toDate(input.endDate)
      : this.addMonths(start, 12);
    const end = proposedEnd > start ? proposedEnd : this.addMonths(start, 12);

    const contract = this.contractRepository.create({
      contractCode:
        input.contractCode ?? (await this.generateContractCode(start)),
      tenant: { id: input.tenantId } as unknown as Contract['tenant'],
      landlord: { id: input.landlordId } as unknown as Contract['landlord'],
      property: { id: input.propertyId } as unknown as Contract['property'],
      startDate: start,
      endDate: end,
      status: ContractStatusEnum.PENDING_SIGNATURE,
      contractFileUrl: input.contractFileUrl,
    });
    return this.contractRepository.save(contract);
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    if (updateContractDto.contractCode)
      contract.contractCode = updateContractDto.contractCode;
    if (updateContractDto.tenantId)
      contract.tenant = {
        id: updateContractDto.tenantId,
      } as unknown as Contract['tenant'];
    if (updateContractDto.landlordId)
      contract.landlord = {
        id: updateContractDto.landlordId,
      } as unknown as Contract['landlord'];
    if (updateContractDto.propertyId)
      contract.property = {
        id: updateContractDto.propertyId,
      } as unknown as Contract['property'];
    if (updateContractDto.startDate)
      contract.startDate = this.toDate(updateContractDto.startDate);
    if (updateContractDto.endDate)
      contract.endDate = this.toDate(updateContractDto.endDate);
    if (updateContractDto.contractFileUrl !== undefined)
      contract.contractFileUrl = updateContractDto.contractFileUrl;
    if (updateContractDto.status) contract.status = updateContractDto.status;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  private ensureStatus(
    contract: Contract,
    expected: ContractStatusEnum[],
  ): void {
    if (!expected.includes(contract.status)) {
      throw new BadRequestException(
        `Invalid state: ${contract.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  async markSigned(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    if (contract.status === ContractStatusEnum.SIGNED) {
      return new ResponseCommon(200, 'SUCCESS', contract);
    }
    this.ensureStatus(contract, [ContractStatusEnum.PENDING_SIGNATURE]);
    contract.status = ContractStatusEnum.SIGNED;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async activate(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [
      ContractStatusEnum.PENDING_SIGNATURE,
      ContractStatusEnum.SIGNED,
    ]);
    contract.status = ContractStatusEnum.ACTIVE;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async complete(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [ContractStatusEnum.ACTIVE]);
    contract.status = ContractStatusEnum.COMPLETED;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancel(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [
      ContractStatusEnum.DRAFT,
      ContractStatusEnum.PENDING_SIGNATURE,
      ContractStatusEnum.SIGNED,
    ]);
    contract.status = ContractStatusEnum.CANCELLED;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async terminate(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [ContractStatusEnum.ACTIVE]);
    contract.status = ContractStatusEnum.TERMINATED;
    const saved = await this.contractRepository.save(contract);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findRawById(id: string): Promise<Contract | null> {
    return this.contractRepository.findOne({
      where: { id },
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  computeHashForSignature(pdfBuffer: Buffer, signatureIndex = 0) {
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new BadRequestException('pdfBuffer must be a Buffer');
    }

    // 1) Thử cách 1: /ByteRange đã có số
    const numericRanges = this.extractAllNumericByteRanges(pdfBuffer);
    if (
      numericRanges.length &&
      signatureIndex >= 0 &&
      signatureIndex < numericRanges.length
    ) {
      const [a, b, c, d] = numericRanges[signatureIndex];
      const len = pdfBuffer.length;
      if (a < 0 || b < 0 || c < 0 || d < 0 || a + b > len || c + d > len) {
        throw new BadRequestException('Invalid ByteRange values');
      }
      const part1 = pdfBuffer.slice(a, a + b);
      const part2 = pdfBuffer.slice(c, c + d);
      const toHash = Buffer.concat([part1, part2]);
      const digestHex = crypto
        .createHash('sha256')
        .update(toHash)
        .digest('hex');
      const digestBase64 = Buffer.from(digestHex, 'hex').toString('base64');

      return {
        mode: 'numeric-ByteRange',
        byteRange: [a, b, c, d],
        digestHex,
        digestBase64,
        algorithm: 'SHA-256',
        signatureCount: numericRanges.length,
        signatureIndex,
        pdfLength: len,
      };
    }

    // 2) Fallback: /ByteRange là placeholder (*) → tính từ vị trí /Contents
    const contentRanges = this.findAllContentsValueRanges(pdfBuffer);
    if (!contentRanges.length) {
      throw new BadRequestException(
        'No /ByteRange or /Contents found (no signature placeholder?)',
      );
    }
    if (signatureIndex < 0 || signatureIndex >= contentRanges.length) {
      throw new BadRequestException(
        `signatureIndex out of range (0..${contentRanges.length - 1})`,
      );
    }

    const { start, end } = contentRanges[signatureIndex];
    const len = pdfBuffer.length;

    // Chuẩn: loại trừ chỉ bytes bên trong <...>, tức:
    // part1 = [0 .. start)
    // part2 = [end .. EOF]
    const part1 = pdfBuffer.slice(0, start);
    const part2 = pdfBuffer.slice(end, len);
    const toHash = Buffer.concat([part1, part2]);

    const digestHex = crypto.createHash('sha256').update(toHash).digest('hex');
    const digestBase64 = Buffer.from(digestHex, 'hex').toString('base64');

    // Tính ByteRange tương đương (a,b,c,d) cho reference (không bắt buộc phải trả, nhưng hữu ích):
    const a = 0;
    const b = start - a;
    const c = end;
    const d = len - c;

    return {
      mode: 'computed-from-Contents', // thông báo đang ở nhánh placeholder
      byteRange: [a, b, c, d],
      digestHex,
      digestBase64,
      algorithm: 'SHA-256',
      signatureCount: contentRanges.length,
      signatureIndex,
      pdfLength: len,
      contentsValueRange: { start, end }, // để debug
    };
  }

  /**
   * Nhúng CMS signature vào đúng placeholder (theo signatureIndex).
   * - Hỗ trợ nhiều /Contents trong PDF.
   * - Chỉ thay /ByteRange + /Contents ở index chỉ định.
   */
  async embedCmsIntoPlaceholder(
    pdfBuffer: Buffer,
    {
      cmsBase64,
      cmsHex,
      signatureIndex = 0,
    }: { cmsBase64?: string; cmsHex?: string; signatureIndex?: number },
  ): Promise<Buffer> {
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new BadRequestException('pdfBuffer must be a Buffer');
    }
    if (!cmsBase64 && !cmsHex) {
      throw new BadRequestException('Must provide cmsBase64 or cmsHex');
    }

    // 1) Chuẩn bị CMS bytes
    let cmsBuf: Buffer;
    if (cmsHex) cmsBuf = Buffer.from(cmsHex, 'hex');
    else cmsBuf = Buffer.from(cmsBase64!, 'base64');

    // 2) Parse toàn bộ /ByteRange và /Contents (chỉ cặp chữ ký – KHÔNG tính /Contents của ảnh/stream)
    const pdfStr = pdfBuffer.toString('latin1');

    // /ByteRange: chấp nhận số hoặc "/****" ở mỗi thành phần
    const byteRangeRe =
      /\/ByteRange\s*\[\s*([0-9/*]+)\s+([0-9/*]+)\s+([0-9/*]+)\s+([0-9/*]+)\s*\]/g;

    // /Contents <HEX...> : chỉ match dạng chữ ký (nội dung HEX trong dấu < >)
    const contentsRe = /\/Contents\s*<([0-9A-Fa-f\s]+)>/g;

    const byteRanges: { text: string; start: number }[] = [];
    const contents: {
      fullText: string; // "/Contents <...>"
      start: number; // vị trí bắt đầu của "/Contents"
      hexStart: number; // vị trí byte đầu tiên bên trong '<...>'
      hexLenChars: number; // số ký tự hex hiện có (đã bỏ khoảng trắng)
    }[] = [];

    // Tìm các /ByteRange
    for (let m = byteRangeRe.exec(pdfStr); m; m = byteRangeRe.exec(pdfStr)) {
      console.log(`DEBUG ByteRange found: "${m[0]}" at position ${m.index}`);
      console.log(`DEBUG ByteRange captured groups:`, m.slice(1));
      byteRanges.push({ text: m[0], start: m.index });
    }
    if (byteRanges.length === 0) {
      throw new BadRequestException('No /ByteRange found in PDF');
    }

    // Tìm các /Contents <...>
    for (let m = contentsRe.exec(pdfStr); m; m = contentsRe.exec(pdfStr)) {
      const full = m[0];
      const start = m.index;
      // Vị trí '<' trong full
      const localOpen = full.indexOf('<');
      if (localOpen < 0) continue;
      const globalHexStart = start + localOpen + 1;

      // Chuỗi hex bên trong (giữ để tính độ dài bytes placeholder)
      const innerHex = m[1].replace(/\s+/g, '');
      const hexLen = innerHex.length;

      contents.push({
        fullText: full,
        start,
        hexStart: globalHexStart,
        hexLenChars: hexLen, // số ký tự HEX (2 ký tự = 1 byte)
      });
    }

    // Lưu ý: chỉ các /Contents đi kèm placeholder mới đứng "song song" với /ByteRange.
    // Số cặp hợp lệ = min(byteRanges.length, contents.length) theo thứ tự xuất hiện.
    const pairCount = Math.min(byteRanges.length, contents.length);
    if (pairCount === 0) {
      throw new BadRequestException('No valid signature placeholders found');
    }
    if (signatureIndex < 0 || signatureIndex >= pairCount) {
      throw new BadRequestException(
        `Signature index ${signatureIndex} out of range (found ${pairCount})`,
      );
    }

    const br = byteRanges[signatureIndex];
    const ct = contents[signatureIndex];

    // 3) Tính độ dài placeholder /Contents (bytes) và chuẩn bị CMS HEX đúng độ dài
    const placeholderBytes = ct.hexLenChars / 2; // 2 ký tự HEX = 1 byte
    if (!Number.isInteger(placeholderBytes)) {
      throw new BadRequestException(
        'Malformed /Contents placeholder (odd hex length)',
      );
    }
    if (cmsBuf.length > placeholderBytes) {
      throw new BadRequestException(
        `CMS length ${cmsBuf.length} exceeds placeholder length ${placeholderBytes}`,
      );
    }

    // Pad bằng 0x00 cho đủ chiều dài placeholder
    const paddedCms = Buffer.concat([
      cmsBuf,
      Buffer.alloc(placeholderBytes - cmsBuf.length, 0),
    ]);
    const cmsHexUpper = paddedCms.toString('hex').toUpperCase(); // length = ct.hexLenChars (giữ nguyên)

    // 4) Ghi đè /Contents HEX IN-PLACE (không đổi tổng số byte)
    const out = Buffer.from(pdfBuffer); // bản sao để sửa
    // Ghi chuỗi HEX mới vào khoảng [hexStart, hexStart + hexLenChars)
    out.write(cmsHexUpper, ct.hexStart, 'latin1');

    // 5) Tính lại 4 số /ByteRange theo PDF spec (trên buffer "out" sau khi đã ghi CMS hex)
    // PDF ByteRange [a b c d] format:
    // Phần 1: từ byte a với độ dài b (phần trước signature)
    // Phần 2: từ byte c với độ dài d (phần sau signature)
    // Phần ở giữa (a+b đến c-1) sẽ bị bỏ qua (chứa signature)
    const start1 = 0; // bắt đầu từ đầu file
    const len1 = ct.hexStart; // từ đầu đến ngay trước hex data (ct.hexStart = vị trí sau '<')
    const start2 = ct.hexStart + ct.hexLenChars; // từ ngay sau hex data cuối cùng
    const len2 = out.length - start2; // phần còn lại từ sau hex data đến cuối file

    console.log('=== embedCmsAtIndex ByteRange calculation (PDF SPEC) ===');
    console.log('ct.hexStart (position after <):', ct.hexStart);
    console.log('ct.hexLenChars (hex content length):', ct.hexLenChars);
    console.log('out.length (total PDF size):', out.length);
    console.log('PDF ByteRange calculation:');
    console.log('  start1:', start1, '(always 0)');
    console.log('  len1:', len1, '(from start to before hex data)');
    console.log('  start2:', start2, '(from after hex data)');
    console.log('  len2:', len2, '(remaining bytes)');
    console.log(
      'ByteRange will exclude bytes from',
      len1,
      'to',
      start2 - 1,
      '(signature area)',
    );

    const numbers = [start1, len1, start2, len2];

    // 6) Ghi đè /ByteRange IN-PLACE VÀ CHỈ VÀO CÁC SLOT '*'
    //    Giữ nguyên dấu '/' đứng trước dãy '*', giữ nguyên mọi khoảng trắng.
    function padFixedWidth(num: number, width: number): string {
      const s = String(num);
      if (s.length > width) {
        throw new BadRequestException(
          `ByteRange number ${s} exceeds placeholder width ${width}`,
        );
      }
      // Left-pad bằng SPACE để đủ bề rộng slot (không làm tăng/giảm số byte)
      return ' '.repeat(width - s.length) + s;
    }

    /**
     * Ghi số vào đúng 4 "slot *" trong chuỗi ByteRange (nếu slot là số cố định, bỏ qua).
     * - brText: nguyên văn "/ByteRange [ ... ]"
     * - brStart: vị trí bắt đầu brText trong buffer gốc
     * - numbers: [b0, b1, b2, b3]
     */
    function writeByteRangeInPlace(
      outBuf: Buffer,
      brText: string, // toàn bộ chuỗi "/ByteRange [ ... ]"
      brStart: number, // vị trí bắt đầu "/ByteRange" trong outBuf
      numbersArr: number[], // [off0, len0, off1, len1]
    ) {
      console.log(`DEBUG writeByteRangeInPlace called with:`);
      console.log(`  brText: "${brText}"`);
      console.log(`  brStart: ${brStart}`);
      console.log(`  numbersArr: [${numbersArr.join(', ')}]`);

      const openIdx = brText.indexOf('[');
      const closeIdx = brText.indexOf(']');
      if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
        throw new BadRequestException('Malformed /ByteRange object');
      }

      const inside = brText.slice(openIdx + 1, closeIdx);
      const insideLen = inside.length;
      console.log(`  inside: "${inside}" (length: ${insideLen})`);

      // Xây các số width cố định = BR_SLOT_WIDTH (căn phải, pad space)
      const fmt = (n: number) => {
        const s = String(n);
        if (s.length > BR_SLOT_WIDTH) {
          throw new BadRequestException(
            `ByteRange number ${n} exceeds fixed width ${BR_SLOT_WIDTH}`,
          );
        }
        return ' '.repeat(BR_SLOT_WIDTH - s.length) + s;
      };

      // CLEAN FORMAT: ensure no "/" characters in output
      const parts = [
        fmt(numbersArr[0]),
        fmt(numbersArr[1]),
        fmt(numbersArr[2]),
        fmt(numbersArr[3]),
      ];
      console.log(
        `  formatted parts: [${parts.map((p) => `"${p}"`).join(', ')}]`,
      );

      // Chuỗi tối thiểu khi ghép bằng 1 space giữa các số
      const MIN_SPACES_BETWEEN = 1;
      const minNeeded =
        parts.reduce((t, p) => t + p.length, 0) + 3 * MIN_SPACES_BETWEEN; // 4 numbers + 3 khoảng trắng

      if (insideLen < minNeeded) {
        throw new BadRequestException(
          `Not enough room to widen /ByteRange to ${BR_SLOT_WIDTH}-char slots (need >= ${minNeeded}, have ${insideLen})`,
        );
      }

      // Phân bổ phần dư (extra spaces) để tổng độ dài KHÔNG đổi
      const extra = insideLen - minNeeded;
      // Chiến lược: dồn hết "extra" vào khoảng trắng cuối cùng trước số thứ 4
      const sep1 = ' '.repeat(MIN_SPACES_BETWEEN);
      const sep2 = ' '.repeat(MIN_SPACES_BETWEEN);
      const sep3 = ' '.repeat(MIN_SPACES_BETWEEN + extra);

      const rebuiltInside =
        parts[0] + sep1 + parts[1] + sep2 + parts[2] + sep3 + parts[3];

      console.log(
        `  rebuiltInside: "${rebuiltInside}" (length: ${rebuiltInside.length})`,
      );

      // Ghi đè phần inside (giữ nguyên tổng chiều dài vùng [ ... ])
      const absInsideStart = brStart + openIdx + 1;
      outBuf.write(rebuiltInside, absInsideStart, 'latin1');

      console.log(`  Written to buffer at position ${absInsideStart}`);
    }

    writeByteRangeInPlace(out, br.text, br.start, numbers);

    // 7) Sanity check (không đổi tổng chiều dài)
    if (out.length !== pdfBuffer.length) {
      throw new BadRequestException(
        `PDF length changed after embed (was ${pdfBuffer.length}, now ${out.length})`,
      );
    }

    // Debug: Check final ByteRange format in output buffer
    const finalPdfStr = out.toString('latin1');
    const finalByteRangeMatch = finalPdfStr.match(/\/ByteRange\s*\[[^\]]+\]/);
    if (finalByteRangeMatch) {
      console.log(
        `DEBUG Final ByteRange in output: "${finalByteRangeMatch[0]}"`,
      );
    }

    return out;
  }

  // --- Helpers ---
  private toDate(value: Date | string): Date {
    if (value instanceof Date) {
      return value;
    }
    const normalized = value.length === 10 ? `${value}T00:00:00` : value;
    const date = zonedTimeToUtc(normalized, VN_TZ);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date provided for contract');
    }
    return date;
  }

  private addMonths(base: Date, months: number): Date {
    const vnBase = utcToZonedTime(base, VN_TZ);
    const vnNext = addMonthsFn(vnBase, months);
    return zonedTimeToUtc(vnNext, VN_TZ);
  }

  private async generateContractCode(referenceDate = vnNow()): Promise<string> {
    const datePart = formatVN(referenceDate, 'yyyyMMdd');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const code = `CT-${datePart}-${random}`;
      const exists = await this.contractRepository.findOne({
        where: { contractCode: code },
      });
      if (!exists) return code;
    }
    throw new Error('Unable to generate unique contract code');
  }

  private buildContractPayload(dto: CreateContractDto) {
    return {
      contractCode: dto.contractCode,
      tenant: { id: dto.tenantId } as unknown as Contract['tenant'],
      landlord: { id: dto.landlordId } as unknown as Contract['landlord'],
      property: { id: dto.propertyId } as unknown as Contract['property'],
      startDate: this.toDate(dto.startDate),
      endDate: this.toDate(dto.endDate),
      status: dto.status ?? ContractStatusEnum.PENDING_SIGNATURE,
      contractFileUrl: dto.contractFileUrl,
    };
  }

  private async loadContractOrThrow(id: string): Promise<Contract> {
    const contract = await this.findRawById(id);
    if (!contract) throw new Error(`Contract with id ${id} not found`);
    return contract;
  }

  // === BACKUP: Ensure ByteRange space bằng cách force expand ByteRange ===
  // REMOVED: ensureByteRangeSpace - không cần thiết cho file nhỏ

  // REMOVED: expandByteRangeAreas - gây lỗi và không cần thiết
  // REMOVED: expandByteRangeAreas - không cần thiết

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

  /**
   * Tính hash theo /ByteRange có sẵn trong PDF (đã prepare).
   * Trả về digestHex + meta (đã có sẵn trong file này).
   */
  public computePdfHashForIndex(pdfBuffer: Buffer, signatureIndex = 0) {
    return this.computeHashForSignature(pdfBuffer, signatureIndex); // đã implement sẵn ở file này
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

  // Tìm tất cả ByteRange có số
  private extractAllNumericByteRanges(pdfBuffer: Buffer): number[][] {
    const s = pdfBuffer.toString('latin1');
    const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    const out: number[][] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      out.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
    }
    return out;
  }

  // Tìm tất cả vị trí <start, end> của giá trị /Contents (chỉ phần bên trong <...>)
  private findAllContentsValueRanges(
    pdfBuffer: Buffer,
  ): Array<{ start: number; end: number }> {
    const s = pdfBuffer.toString('latin1');
    const ranges: Array<{ start: number; end: number }> = [];

    // Duyệt tất cả occurrences của "/Contents"
    const re = /\/Contents\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const after = m.index + m[0].length;
      // Tìm dấu < đầu tiên sau /Contents
      const lt = s.indexOf('<', after);
      if (lt === -1) continue;
      // Tìm dấu > tương ứng sau dấu <
      const gt = s.indexOf('>', lt + 1);
      if (gt === -1) continue;

      // Giá trị /Contents nằm trong (lt+1 .. gt) theo index byte
      ranges.push({ start: lt + 1, end: gt }); // [start, end): end không bao gồm '>'
      // Tiếp tục tìm các /Contents tiếp theo
    }
    return ranges;
  }

  // Điền 4 số của 1 /ByteRange theo vị trí <...> của /Contents ngay sau đó.
  // FIXED: ByteRange theo PDF spec - bao gồm 2 phần không bao gồm signature hex data
  private fillOneByteRange(
    pdf: Buffer,
    brOpenIdx: number, // vị trí '['
    brCloseIdx: number, // vị trí ']'
    contentsStart: number, // vị trí '<' của /Contents
    contentsEndExclusive: number, // ngay sau '>'
  ): Buffer {
    // PDF ByteRange [a b c d] format:
    // Phần 1: từ byte a với độ dài b
    // Phần 2: từ byte c với độ dài d
    // Phần ở giữa (a+b đến c-1) sẽ bị bỏ qua (chứa signature)
    const a = 0; // bắt đầu từ đầu file
    const b = contentsStart; // từ đầu đến vị trí '<' (exclusive)
    const c = contentsEndExclusive; // từ ngay sau vị trí '>' (inclusive)
    const d = pdf.length - c; // phần còn lại từ sau '>' đến cuối file

    console.log('=== fillOneByteRange DEBUG (FIXED CALCULATION) ===');
    console.log('contentsStart (position of <):', contentsStart);
    console.log(
      'contentsEndExclusive (position after >):',
      contentsEndExclusive,
    );
    console.log('pdf.length:', pdf.length);
    console.log('PDF ByteRange calculation:');
    console.log('  a (start1):', a, '(always 0)');
    console.log('  b (len1):', b, '(from start to position of < exclusive)');
    console.log('  c (start2):', c, '(from position after > inclusive)');
    console.log('  d (len2):', d, '(remaining bytes)');
    console.log(
      'ByteRange will exclude bytes from',
      a + b,
      'to',
      c - 1,
      '(signature area)',
    );

    return this.fillMixedByteRangeDynamic(pdf, brOpenIdx, brCloseIdx, [
      a,
      b,
      c,
      d,
    ]);
  }

  // REMOVED: expandAndFillByteRange - không cần thiết

  // === Helper: Fill mixed ByteRange với dynamic width detection ===
  private fillMixedByteRangeDynamic(
    pdf: Buffer,
    brOpenIdx: number,
    brCloseIdx: number,
    values: number[],
  ): Buffer {
    console.log(
      `DEBUG fillMixedByteRangeDynamic called with values: [${values.join(', ')}]`,
    );

    const s = pdf.toString('latin1');
    const insideStart = brOpenIdx + 1;
    const insideEnd = brCloseIdx;
    const insideText = s.slice(insideStart, insideEnd);

    console.log(`DEBUG insideText: "${insideText}"`);

    // Parse tokens trong ByteRange và lọc bỏ dấu "/"
    const allTokens = insideText.trim().split(/\s+/);
    const tokens = allTokens.filter((token) => token !== '/');
    console.log(
      `DEBUG allTokens: [${allTokens.map((t) => `"${t}"`).join(', ')}]`,
    );
    console.log(
      `DEBUG filtered tokens: [${tokens.map((t) => `"${t}"`).join(', ')}]`,
    );

    if (tokens.length < 4) {
      throw new BadRequestException('Invalid ByteRange format in mixed mode');
    }

    // Replace mỗi token: LUÔN sử dụng calculated values
    const newTokens = tokens.slice(0, 4).map((token, idx) => {
      console.log(`DEBUG processing token[${idx}]: "${token}"`);

      // LUÔN sử dụng calculated value thay vì token từ PDF
      const calculatedValue = values[idx];
      const numStr = String(calculatedValue);

      if (token.includes('*')) {
        // Placeholder: thay bằng số với width = length của placeholder
        const cleanToken = token.startsWith('/') ? token.slice(1) : token;
        const starCount = cleanToken.length;

        console.log(
          `DEBUG placeholder: cleanToken="${cleanToken}", starCount=${starCount}, calculatedValue=${calculatedValue}`,
        );

        if (numStr.length > starCount) {
          throw new BadRequestException(
            `ByteRange number ${numStr} exceeds placeholder width ${starCount}`,
          );
        }

        const paddedNum = ' '.repeat(starCount - numStr.length) + numStr;
        console.log(
          `DEBUG result for token[${idx}]: calculated="${calculatedValue}" -> padded="${paddedNum}"`,
        );
        return paddedNum;
      } else {
        // Số đã có sẵn: THAY THẾ bằng calculated value với cùng width
        const originalWidth = token.startsWith('/')
          ? token.slice(1).length
          : token.length;

        if (numStr.length > originalWidth) {
          throw new BadRequestException(
            `ByteRange calculated number ${numStr} exceeds original width ${originalWidth}`,
          );
        }

        const paddedNum = ' '.repeat(originalWidth - numStr.length) + numStr;
        console.log(
          `DEBUG fixed number for token[${idx}]: original="${token}" calculated="${calculatedValue}" -> padded="${paddedNum}"`,
        );
        return paddedNum;
      }
    });

    console.log(
      `DEBUG newTokens: [${newTokens.map((t) => `"${t}"`).join(', ')}]`,
    );

    // Rebuild inside text với original spacing
    const newInside = newTokens.join(' ').padEnd(insideText.length, ' ');
    console.log(`DEBUG newInside: "${newInside}"`);

    // Replace in-place
    const result = s.slice(0, insideStart) + newInside + s.slice(insideEnd);
    const resultBuffer = Buffer.from(result, 'latin1');

    // Verify final result
    const finalInsideText = result.slice(
      insideStart,
      insideStart + newInside.length,
    );
    console.log(`DEBUG final inside text: "${finalInsideText}"`);

    return resultBuffer;
  }

  /**
   * Quét lần lượt TẤT CẢ placeholder trong PDF:
   * - Mỗi lần gặp "/ByteRange [ ... ]", tìm "/Contents <...>" ngay sau đó
   * - Tính 4 số [0 len0 off1 len1] và ghi đè in-place (không thay đổi độ dài file)
   * - Trả về Buffer đã finalize /ByteRange cho mọi placeholder
   */
  public finalizeAllByteRanges(pdf: Buffer): Buffer {
    let buf = Buffer.from(pdf); // làm việc trên copy
    let searchFrom = 0;

    const tokenBR = Buffer.from('/ByteRange', 'ascii');
    const tokenOpenBracket = Buffer.from('[', 'ascii');
    const tokenCloseBracket = Buffer.from(']', 'ascii');
    const tokenCT = Buffer.from('/Contents', 'ascii');

    while (true) {
      // 1) Tìm /ByteRange
      const brIdx = buf.indexOf(tokenBR, searchFrom);
      if (brIdx === -1) break;

      // '[' sau /ByteRange
      const brOpen = buf.indexOf(tokenOpenBracket, brIdx);
      if (brOpen === -1) break;

      // ']' đóng mảng ByteRange — phải xuất hiện trước /Contents kế tiếp
      const nextCT = buf.indexOf(tokenCT, brOpen);
      let brClose = -1;
      const firstCloseAfterOpen = buf.indexOf(tokenCloseBracket, brOpen);
      if (firstCloseAfterOpen === -1) {
        throw new BadRequestException(
          'Malformed /ByteRange array (missing ]).',
        );
      }
      if (nextCT !== -1 && firstCloseAfterOpen > nextCT) {
        throw new BadRequestException(
          'Malformed /ByteRange array (] after /Contents).',
        );
      }
      brClose = firstCloseAfterOpen;

      // 2) Tìm /Contents <...> theo sau
      const ctIdx = buf.indexOf(tokenCT, brClose);
      if (ctIdx === -1) {
        throw new BadRequestException(
          'Cannot find /Contents for a /ByteRange.',
        );
      }
      const lt = buf.indexOf('<', ctIdx);
      const gt = buf.indexOf('>', lt);
      if (lt === -1 || gt === -1) {
        throw new BadRequestException('Malformed /Contents hex string.');
      }
      const contentsStart = lt; // vị trí '<'
      const contentsEndExclusive = gt + 1; // ngay sau '>'

      // 3) Điền bốn số cho /ByteRange hiện tại
      console.log(
        'DEBUG fillMixedByteRangeDynamic: calling fillOneByteRange with params:',
      );
      console.log('  brOpen:', brOpen);
      console.log('  brClose:', brClose);
      console.log('  contentsStart:', contentsStart);
      console.log('  contentsEndExclusive:', contentsEndExclusive);

      buf = this.fillOneByteRange(
        buf,
        brOpen,
        brClose,
        contentsStart,
        contentsEndExclusive,
      );

      // 4) Tiếp tục quét sau phần /Contents này (hỗ trợ nhiều placeholder)
      searchFrom = contentsEndExclusive;
    }

    return buf;
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

    // Helper functions for ByteRange calculation and filling
    const padFixedWidth = (num: number, width: number): string => {
      const s = String(num);
      if (s.length > width) {
        throw new BadRequestException(
          `ByteRange number ${s} exceeds placeholder width ${width}`,
        );
      }
      return ' '.repeat(width - s.length) + s;
    };

    const writeByteRangeInPlace = (
      outBuf: Buffer,
      brText: string,
      brStart: number,
      values: number[], // [a,b,c,d]
    ) => {
      const starRe = /\/\*+|\*+/g; // "/****" or "****"
      const runs: { absPos: number; width: number }[] = [];
      for (let m = starRe.exec(brText); m; m = starRe.exec(brText)) {
        const full = m[0];
        const hasSlash = full.startsWith('/');
        const width = full.length - (hasSlash ? 1 : 0);
        const absPos = brStart + m.index + (hasSlash ? 1 : 0);
        runs.push({ absPos, width });
      }
      // Map star runs back to which component (0..3) they belong to
      const inside = brText.slice(brText.indexOf('[') + 1, brText.indexOf(']'));
      const tokens = inside.trim().split(/\s+/); // expect 4
      if (tokens.length < 4) {
        throw new BadRequestException('Unexpected /ByteRange tokens');
      }
      const starredIdxs: number[] = [];
      tokens.forEach((tk, idx) => {
        if (tk.includes('*')) starredIdxs.push(idx);
      });
      if (runs.length !== starredIdxs.length) {
        throw new BadRequestException('Star slot count mismatch in /ByteRange');
      }
      for (let i = 0; i < runs.length; i += 1) {
        const comp = starredIdxs[i];
        const r = runs[i];
        outBuf.write(padFixedWidth(values[comp], r.width), r.absPos, 'latin1');
      }
    };

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

    // 8) TEMPORARILY DISABLED: Recalculate ALL ByteRanges after embedding CMS
    // Testing to see if signatures work without recalculation
    console.log('DISABLED: Recalculating all ByteRanges after CMS embed...');
    // finalPdf = this.recalculateAllByteRanges(finalPdf);

    // Debug: Check final PDF content around ByteRange positions
    console.log('\n=== FINAL PDF CONTENT ANALYSIS ===');
    const finalPdfString = finalPdf.toString('latin1'); // CRITICAL: Use latin1 encoding!

    // Debug: Check actual bytes at the embedded position
    console.log('\n=== BYTE-LEVEL CMS VERIFICATION ===');
    const cmsDataStart = contentsStart + 1; // CMS data starts AFTER '<'
    console.log(
      'Checking bytes at position',
      cmsDataStart,
      'to',
      cmsDataStart + 20,
    );
    const bytesAtPosition = finalPdf.subarray(cmsDataStart, cmsDataStart + 20);
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

    // *** NEW: Calculate and fill ByteRange using pre-calculated values ***
    console.log('\n=== FILLING BYTERANGE WITH PRE-CALCULATED VALUES ===');

    // Find ByteRange placeholders (with * or / patterns) that need to be filled
    const brRe = /\/ByteRange\s*\[\s*([^[\]]*?)\s*\]/g;
    const placeholderMatches: Array<{
      text: string;
      start: number;
      components: string[];
      insideContent: string;
    }> = [];
    let finalPdfWithByteRange = finalPdfString;

    for (let m = brRe.exec(finalPdfString); m; m = brRe.exec(finalPdfString)) {
      const insideContent = m[1]; // Everything inside [ ]
      const components = insideContent.trim().split(/\s+/); // Split by whitespace

      console.log(`Found ByteRange: "${m[0]}"`);
      console.log(`  Inside content: "${insideContent}"`);
      console.log(`  Components: [${components.join(', ')}]`);

      placeholderMatches.push({
        text: m[0],
        start: m.index,
        components: components,
        insideContent: insideContent,
      });
    }

    console.log(`Found ${placeholderMatches.length} ByteRange placeholders`);

    // Fill ByteRange for the signature we just embedded (signatureIndex)
    if (placeholderMatches.length > signatureIndex) {
      const brMatch = placeholderMatches[signatureIndex];

      // Check if this ByteRange has placeholder values (contains * or /)
      const hasPlaceholders = brMatch.components.some(
        (comp) => comp.includes('*') || comp.includes('/'),
      );

      console.log(`\nProcessing ByteRange #${signatureIndex}:`);
      console.log(`  Components: [${brMatch.components.join(', ')}]`);
      console.log(`  Has placeholders: ${hasPlaceholders}`);

      if (hasPlaceholders) {
        console.log(
          `Filling ByteRange #${signatureIndex} with pre-calculated values:`,
        );
        console.log(`  Values: [${a}, ${b}, ${c}, ${d}]`);

        // Create new ByteRange content with proper formatting
        const newByteRangeContent = `${a} ${b} ${c} ${d}`;
        const paddedContent = newByteRangeContent.padEnd(
          brMatch.insideContent.length,
          ' ',
        );

        console.log(`  Original inside: "${brMatch.insideContent}"`);
        console.log(`  New inside: "${paddedContent}"`);

        // Replace the ByteRange content
        const beforeBr = finalPdfWithByteRange.substring(0, brMatch.start);
        const afterBr = finalPdfWithByteRange.substring(
          brMatch.start + brMatch.text.length,
        );
        const newBrText = `/ByteRange [${paddedContent}]`;

        finalPdfWithByteRange = beforeBr + newBrText + afterBr;

        console.log(`  ByteRange #${signatureIndex} filled successfully`);
      } else {
        console.log(
          `\nByteRange #${signatureIndex} already has numeric values, skipping`,
        );
      }
    } else {
      console.log(
        `\nWarning: Could not find ByteRange #${signatureIndex} to fill`,
      );
    }

    // Update final PDF with calculated ByteRanges
    let finalPdfResult = Buffer.from(finalPdfWithByteRange, 'latin1');
    console.log('=== BYTERANGE FILLING COMPLETE ===\n');

    console.log('=== EMBED CMS DEBUG END ===\n');
    return finalPdfResult;
  }

  /**
   * Recalculate all ByteRanges in the PDF after CMS embedding
   * This is critical because embedding CMS shifts positions
   */
  private recalculateAllByteRanges(pdf: Buffer): Buffer {
    const s = pdf.toString('latin1');
    let result = Buffer.from(pdf);

    // Find all /ByteRange [...] entries with capture group for inside content
    const byteRangePattern = /\/ByteRange\s*\[([^\]]*)\]/g;
    const matches = [...s.matchAll(byteRangePattern)];

    console.log(`Found ${matches.length} ByteRange entries to recalculate`);

    // For each ByteRange, find its corresponding /Contents and recalculate
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const fullMatch = match[0]; // "/ByteRange [...]"
      const insideContent = match[1]; // "0 222504 353578 133270               "
      const brStart = match.index!;
      const brFullEnd = brStart + fullMatch.length;

      // Find positions of [ and ] to target only the inside content
      const openBracket = brStart + fullMatch.indexOf('[');
      const closeBracket = brStart + fullMatch.lastIndexOf(']');

      // Find the corresponding /Contents for this ByteRange
      const afterBR = s.substring(brFullEnd);
      const contentsMatch = afterBR.match(/\/Contents\s*<([^>]*)>/);

      if (contentsMatch) {
        const contentsStart =
          brFullEnd + contentsMatch.index! + contentsMatch[0].indexOf('<');
        const contentsEnd =
          contentsStart +
          contentsMatch[0].substring(contentsMatch[0].indexOf('<')).length;

        // Recalculate ByteRange for this signature
        const values = [
          0, // a: start of first range
          contentsStart, // b: end of first range
          contentsEnd, // c: start of second range
          result.length - contentsEnd, // d: length of second range
        ];

        console.log(`Recalculating ByteRange #${i}: [${values.join(', ')}]`);

        // Update this specific ByteRange (only the inside content between [ and ])
        result = this.fillMixedByteRangeDynamic(
          result,
          openBracket,
          closeBracket,
          values,
        );
      }
    }

    return result;
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
        // Optional: có thể log warning thay vì throw error
        // throw new BadRequestException(
        //   `BYTE_RANGE_MISMATCH: declared=[${decl.a},${decl.b},${decl.c},${decl.d}] should=[${should.join(',')}]`,
        // );
      }

      // Nếu chỉ lệch ở d (thường do thêm vài byte sau '>'), KHÔNG ném lỗi.
      // Ta vẫn hash theo 'should' (gap) vì đó mới là chiều dài thực tế.
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
    );

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
      } catch {}
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

  private derBase64ToPem(derB64: string, label = 'CERTIFICATE'): string {
    const clean = derB64.replace(/\s+/g, '');
    const b64 = Buffer.from(Buffer.from(clean, 'base64')).toString('base64');
    const chunk = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
    return `-----BEGIN ${label}-----\n${chunk}\n-----END ${label}-----\n`;
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

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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

  // Hash đúng chuẩn theo phạm vi gap đã xác định
  private hashForSignatureByGap(
    pdf: Buffer,
    gap: { start: number; end: number },
  ) {
    const md = require('crypto').createHash('sha256');
    if (gap.start > 0) md.update(pdf.subarray(0, gap.start));
    if (gap.end < pdf.length) md.update(pdf.subarray(gap.end));
    return { digestHex: md.digest('hex') };
  }

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

  fmtBR(n: number): string {
    const s = String(n);
    if (s.length > BR_SLOT_WIDTH) {
      throw new BadRequestException(
        `ByteRange number ${n} exceeds fixed width ${BR_SLOT_WIDTH}`,
      );
    }
    return ' '.repeat(BR_SLOT_WIDTH - s.length) + s;
  }

  pad12(n: number): string {
    const s = String(n);
    if (s.length > BR_SLOT_WIDTH) {
      throw new BadRequestException(
        `ByteRange number ${n} exceeds ${BR_SLOT_WIDTH} chars`,
      );
    }
    return ' '.repeat(BR_SLOT_WIDTH - s.length) + s;
  }

  nthMatch(
    s: string,
    re: RegExp, // phải có cờ /g
    n: number,
  ): RegExpExecArray | null {
    re.lastIndex = 0;
    let i = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (i++ === n) return m;
    }
    return null;
  }

  fixLen1IfNeededByIndex(buf: Buffer, brIndex: number): Buffer {
    const s = buf.toString('latin1');

    // Tìm ByteRange thứ brIndex
    const brKeyRe = /\/ByteRange\s*\[/g;
    const brKey = this.nthMatch(s, brKeyRe, brIndex);
    if (!brKey)
      throw new BadRequestException(`ByteRange #${brIndex} not found`);
    const brKeyPos = brKey.index;

    const brOpen = s.indexOf('[', brKeyPos);
    const brClose = s.indexOf(']', brOpen);
    if (brOpen < 0 || brClose < 0)
      throw new BadRequestException('Malformed /ByteRange');

    const inside = s.slice(brOpen + 1, brClose);
    const nums = inside.trim().split(/\s+/);
    if (nums.length < 4)
      throw new BadRequestException('Malformed /ByteRange (need 4 numbers)');

    const a = parseInt(nums[0], 10);
    const b = parseInt(nums[1], 10);
    const c = parseInt(nums[2], 10);
    const d = parseInt(nums[3], 10);

    // Kiểm tra cơ bản
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      !Number.isFinite(c) ||
      !Number.isFinite(d)
    ) {
      throw new BadRequestException('Invalid /ByteRange numbers');
    }
    if (a !== 0 || b !== c) {
      // Với template chuẩn chúng ta dùng, b luôn phải bằng c
      throw new BadRequestException(
        'Unexpected /ByteRange values (a!=0 or b!=c)',
      );
    }

    const shouldD = buf.length - c;
    if (shouldD === d) return buf; // không cần sửa

    // Rebuild lại phần bên trong `[...]` với width=12, giữ NGUYÊN tổng chiều dài `inside`
    const parts = [
      this.pad12(a),
      this.pad12(b),
      this.pad12(c),
      this.pad12(shouldD),
    ];
    const baseLen =
      parts.reduce((t, p) => t + p.length, 0) + 3 * MIN_SPACES_BETWEEN;

    if (baseLen > inside.length) {
      // Trường hợp này hầu như không xảy ra vì bạn đã widen từ /prepare
      throw new BadRequestException(
        'Not enough room inside /ByteRange to rewrite',
      );
    }

    const extra = inside.length - baseLen; // dồn hết vào sep cuối
    const sep1 = ' '.repeat(MIN_SPACES_BETWEEN);
    const sep2 = ' '.repeat(MIN_SPACES_BETWEEN);
    const sep3 = ' '.repeat(MIN_SPACES_BETWEEN + extra);
    const rebuiltInside =
      parts[0] + sep1 + parts[1] + sep2 + parts[2] + sep3 + parts[3];

    const out = s.slice(0, brOpen + 1) + rebuiltInside + s.slice(brClose);
    return Buffer.from(out, 'latin1');
  }
}
