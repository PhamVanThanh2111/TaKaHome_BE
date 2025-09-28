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
}
