import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
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
      /\/ByteRange\s*\[\s*([0-9\/\*]+)\s+([0-9\/\*]+)\s+([0-9\/\*]+)\s+([0-9\/\*]+)\s*\]/g;

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

    // 5) Tính lại 4 số /ByteRange theo ABS positions (trên buffer "out" sau khi đã ghi CMS hex)
    // start1 luôn = 0
    const start1 = 0;
    // len1 = số byte từ đầu file tới ngay trước KÝ TỰ HEX đầu tiên trong <...>
    const len1 = ct.hexStart - start1;
    // start2 = vị trí sau phần HEX (vì độ dài hex giữ nguyên ⇒ hexEnd như cũ)
    const start2 = ct.hexStart + ct.hexLenChars;
    // len2 = phần còn lại
    const len2 = out.length - start2;

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
      brText: string,
      brStart: number,
      numbersArr: number[],
    ) {
      // Lấy phần bên trong dấu [ ... ] để biết token nào là '*' / có '/'
      const openIdx = brText.indexOf('[');
      const closeIdx = brText.indexOf(']');
      if (openIdx < 0 || closeIdx < 0 || closeIdx <= openIdx) {
        throw new BadRequestException('Malformed /ByteRange object');
      }
      const inside = brText.slice(openIdx + 1, closeIdx);

      // Tìm lần lượt các dải '*' (có thể là "/****" hoặc "****"), theo thứ tự xuất hiện
      const starRuns: { absPos: number; width: number }[] = [];
      const starRe = /\/\*+|\*+/g; // match "/****" hoặc "****"
      for (let m = starRe.exec(brText); m; m = starRe.exec(brText)) {
        const full = m[0];
        const hasSlash = full.startsWith('/');
        const width = full.length - (hasSlash ? 1 : 0); // số lượng '*'
        const localPos = m.index + (hasSlash ? 1 : 0); // vị trí ngay sau '/' nếu có
        const absPos = brStart + localPos;
        starRuns.push({ absPos, width });
      }

      // Xác định các token trong "inside" để biết slot nào thuộc thành phần thứ mấy (0..3)
      // Sau đó map theo thứ tự: thành phần nào chứa '*' thì lấy 1 starRun tương ứng theo thứ tự.
      const tokens = inside.trim().split(/\s+/); // 4 tokens
      if (tokens.length < 4) {
        throw new BadRequestException('Unexpected /ByteRange tokens');
      }

      // Xác định thành phần nào là slot (*)
      const starredIdxs: number[] = [];
      tokens.forEach((tk, idx) => {
        if (tk.includes('*')) starredIdxs.push(idx);
      });

      if (starRuns.length !== starredIdxs.length) {
        // Trong thực tế thường là 3 slot (*) cho các thành phần 1..3, b0 = "0"
        // Nhưng nếu placeholder thay đổi hình dạng, cần đồng bộ số slot.
        throw new BadRequestException('Unexpected ByteRange placeholder shape');
      }

      // Ghi số cho các slot theo thứ tự
      for (let i = 0; i < starRuns.length; i++) {
        const compIndex = starredIdxs[i]; // thành phần thứ mấy (0..3)
        const run = starRuns[i];
        const valStr = padFixedWidth(numbersArr[compIndex], run.width);
        outBuf.write(valStr, run.absPos, 'latin1');
      }
    }

    writeByteRangeInPlace(out, br.text, br.start, numbers);

    // 7) Sanity check (không đổi tổng chiều dài)
    if (out.length !== pdfBuffer.length) {
      throw new BadRequestException(
        `PDF length changed after embed (was ${pdfBuffer.length}, now ${out.length})`,
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

  async preparePlaceholder(
    pdfBuffer: Buffer,
    options: PrepareOptions,
  ): Promise<Buffer> {
    const places: Place[] = 'places' in options ? options.places : [options];

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('pdfBuffer must be a Buffer');
    }
    if (!places.length) {
      return Promise.resolve(pdfBuffer);
    }

    const defaultRect: [number, number, number, number] = [50, 50, 250, 120];

    // Gọi plainAddPlaceholder nhiều lần, lần nào cũng dùng buffer mới nhất
    let out = Buffer.from(pdfBuffer);

    places.forEach((p, idx) => {
      const rect = p.rect ?? defaultRect;

      // Tên field cố định, tránh trùng
      const name = p.name?.trim() || `Signature${idx + 1}`;

      // signatureLength nên đủ lớn cho CMS (thường 12k–16k là an toàn cho RSA)
      const signatureLength = Number.isFinite(p.signatureLength as number)
        ? Number(p.signatureLength)
        : 12000;

      // kiểm tra rect hợp lệ
      if (
        !Array.isArray(rect) ||
        rect.length !== 4 ||
        rect.some((n) => typeof n !== 'number' || !Number.isFinite(n))
      ) {
        throw new Error(`Invalid rect for placeholder #${idx + 1}`);
      }

      out = Buffer.from(
        plainAddPlaceholder({
          pdfBuffer: out,
          name,
          signatureLength,
          // Các metadata tuỳ chọn
          reason: p.reason ?? '',
          contactInfo: p.contactInfo ?? '',
          location: p.location ?? '',
        }),
      );
    });

    return out;
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

  // Tìm tất cả “ô” /ByteRange [ ... ] để biết vị trí phần bên trong [ .. ] cần ghi đè.
  private findAllByteRangeBrackets(pdfBuffer: Buffer) {
    const s = pdfBuffer.toString('latin1');
    const re = /\/ByteRange\s*\[/g;
    const out: { innerStart: number; innerEnd: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const bracketStart = s.indexOf('[', m.index);
      if (bracketStart === -1) continue;
      const bracketEnd = s.indexOf(']', bracketStart + 1);
      if (bracketEnd === -1) continue;
      out.push({ innerStart: bracketStart + 1, innerEnd: bracketEnd }); // vùng giữa [ ... ]
    }
    return out;
  }

  // Ghi chuỗi (latin1) vào buffer trong khoảng [start, end), pad bằng padChar nếu thiếu
  private writeStringIntoBuffer(
    buf: Buffer,
    start: number,
    end: number,
    value: string,
    padChar = ' ',
  ) {
    const slot = end - start;
    if (value.length > slot) {
      throw new BadRequestException('Replacement longer than reserved slot');
    }
    const s = value + padChar.repeat(slot - value.length);
    for (let i = 0; i < slot; i++) {
      buf[start + i] = s.charCodeAt(i) & 0xff; // latin1
    }
  }

  /** Lấy bytes "to be signed" cho placeholder: toàn bộ PDF trừ phần bên trong <...> của /Contents tương ứng */
  private getToBeSignedBytes(pdfBuffer: Buffer, signatureIndex = 0): Buffer {
    // ưu tiên dùng ByteRange có số (nếu đã có), nếu không thì lấy theo vị trí /Contents
    const numericRanges = this.extractAllNumericByteRanges(pdfBuffer);
    if (numericRanges.length) {
      if (signatureIndex < 0 || signatureIndex >= numericRanges.length) {
        throw new BadRequestException(
          `signatureIndex out of range (0..${numericRanges.length - 1})`,
        );
      }
      const [a, b, c, d] = numericRanges[signatureIndex];
      const len = pdfBuffer.length;
      if (a < 0 || b < 0 || c < 0 || d < 0 || a + b > len || c + d > len) {
        throw new BadRequestException('Invalid ByteRange values');
      }
      const p1 = pdfBuffer.slice(a, a + b);
      const p2 = pdfBuffer.slice(c, c + d);
      return Buffer.concat([p1, p2]);
    }

    // Fallback: placeholder còn '*', xác định theo /Contents <...>
    const contents = this.findAllContentsValueRanges(pdfBuffer);
    if (!contents.length)
      throw new BadRequestException('No /ByteRange or /Contents found');
    if (signatureIndex < 0 || signatureIndex >= contents.length) {
      throw new BadRequestException(
        `signatureIndex out of range (0..${contents.length - 1})`,
      );
    }
    const { start, end } = contents[signatureIndex];
    const p1 = pdfBuffer.slice(0, start);
    const p2 = pdfBuffer.slice(end);
    return Buffer.concat([p1, p2]);
  }

  /** Tạo keypair + self-signed cert RSA-2048 (dùng tạm để ký mock) */
  private generateSelfSignedCert() {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);

    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    const now = new Date();
    cert.validity.notBefore = new Date(now.getTime() - 5 * 60 * 1000);
    cert.validity.notAfter = new Date(now.getTime() + 365 * 24 * 3600 * 1000);

    const attrs = [
      { name: 'commonName', value: 'Mock Signer' },
      { name: 'organizationName', value: 'Demo Org' },
      { shortName: 'OU', value: 'Dev' },
      { shortName: 'C', value: 'VN' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', codeSigning: true, emailProtection: true },
      { name: 'nsCertType', client: true, email: true, objsign: true },
      { name: 'subjectKeyIdentifier' },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);
    return { keys, cert, certPem, keyPem };
  }

  /** Tạo CMS (PKCS#7) detached SHA-256 cho dữ liệu cần ký */
  private createDetachedCmsSha256(
    toBeSigned: Buffer,
    keys: forge.pki.KeyPair,
    cert: forge.pki.Certificate,
  ) {
    const p7 = forge.pkcs7.createSignedData();
    // put content for computing messageDigest; although detached, we still set content
    p7.content = forge.util.createBuffer(toBeSigned.toString('binary'));
    p7.addCertificate(cert);
    p7.addSigner({
      key: keys.privateKey,
      certificate: cert,
      // OID SHA-256
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest }, // will be auto-computed from content with the selected digest
        { type: forge.pki.oids.signingTime, value: new Date() },
      ],
    });
    // detached signedData
    p7.sign({ detached: true });

    const asn1 = p7.toAsn1();
    const derBytes = forge.asn1.toDer(asn1).getBytes();
    const derBuf = Buffer.from(derBytes, 'binary');
    return {
      cmsBase64: derBuf.toString('base64'),
      cmsHex: derBuf.toString('hex').toUpperCase(),
      cmsDer: derBuf,
    };
  }

  /**
   * Public API trong service: tạo CMS mock cho đúng placeholder
   * Trả về cmsBase64 + cmsHex + thumbprint cert để debug.
   */
  generateMockCmsForPdf(pdfBuffer: Buffer, signatureIndex = 0) {
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new BadRequestException('pdfBuffer must be a Buffer');
    }
    const toBeSigned = this.getToBeSignedBytes(pdfBuffer, signatureIndex);

    const { keys, cert, certPem, keyPem } = this.generateSelfSignedCert();
    const { cmsBase64, cmsHex } = this.createDetachedCmsSha256(
      toBeSigned,
      keys,
      cert,
    );

    // Thumbprint (SHA-256) của cert để tham chiếu
    const certDer = Buffer.from(
      forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
      'binary',
    );
    const certThumbHex = crypto
      .createHash('sha256')
      .update(certDer)
      .digest('hex');

    return {
      signatureIndex,
      algorithm: 'sha256WithRSAEncryption',
      cmsBase64,
      cmsHex,
      certificate: {
        subjectCN: 'Mock Signer',
        pem: certPem,
        thumbprintSha256Hex: certThumbHex,
      },
      // Bạn có thể bỏ keyPem khi deploy thực tế (chỉ để demo):
      privateKeyPem: keyPem,
    };
  }
}
