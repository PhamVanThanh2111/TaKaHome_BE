import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { BlockchainService } from '../blockchain/blockchain.service';
import { FabricUser } from '../blockchain/interfaces/fabric.interface';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { Place, PrepareOptions } from '../smartca/types/smartca.types';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private blockchainService: BlockchainService,
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

    const savedContract = await this.contractRepository.save(contract);

    // Tích hợp với blockchain: Tạo contract trên blockchain
    try {
      await this.createContractOnBlockchain(savedContract);
      this.logger.log(
        `Contract ${savedContract.contractCode} created on blockchain successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create contract ${savedContract.contractCode} on blockchain:`,
        error,
      );
      // Đánh dấu contract cần đồng bộ lại với blockchain
      await this.markForBlockchainSync(savedContract.id, 'CREATE_CONTRACT');
    }

    return savedContract;
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

    // Tích hợp với blockchain: Tenant ký hợp đồng
    try {
      await this.tenantSignContractOnBlockchain(saved);
      this.logger.log(
        `Contract ${saved.contractCode} signed by tenant on blockchain successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sign contract ${saved.contractCode} on blockchain:`,
        error,
      );
      await this.markForBlockchainSync(saved.id, 'TENANT_SIGN_CONTRACT');
    }

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

    // Tích hợp với blockchain: Kích hoạt hợp đồng
    // try {
    //   await this.activateContractOnBlockchain(saved);
    //   this.logger.log(`Contract ${saved.contractCode} activated on blockchain successfully`);
    // } catch (error) {
    //   this.logger.error(`Failed to activate contract ${saved.contractCode} on blockchain:`, error);
    //   await this.markForBlockchainSync(saved.id, 'ACTIVATE_CONTRACT');
    // }

    // Tự động tạo payment schedule sau khi activate
    try {
      await this.createPaymentScheduleOnBlockchain(saved);
      this.logger.log(
        `Payment schedule created for contract ${saved.contractCode}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create payment schedule for contract ${saved.contractCode}:`,
        error,
      );
      await this.markForBlockchainSync(saved.id, 'CREATE_PAYMENT_SCHEDULE');
    }

    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  /**
   * Activate contract without any blockchain calls (used when first payment already activated it)
   * Only updates database status - blockchain is already handled by recordFirstPayment
   */
  // async activateFromFirstPayment(id: string): Promise<ResponseCommon<Contract>> {
  //   const contract = await this.loadContractOrThrow(id);
  //   this.ensureStatus(contract, [
  //     ContractStatusEnum.PENDING_SIGNATURE,
  //     ContractStatusEnum.SIGNED,
  //   ]);
  //   contract.status = ContractStatusEnum.ACTIVE;
  //   const saved = await this.contractRepository.save(contract);

  //   // CHỈ cập nhật database - blockchain đã được xử lý bởi recordFirstPayment
  //   // recordFirstPayment tự động: activate contract + create payment schedule
  //   this.logger.log(`Contract ${saved.contractCode} activated from first payment (blockchain sync completed by recordFirstPayment)`);

  //   return new ResponseCommon(200, 'SUCCESS', saved);
  // }

  async complete(id: string): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [ContractStatusEnum.ACTIVE]);
    contract.status = ContractStatusEnum.COMPLETED;
    const saved = await this.contractRepository.save(contract);

    // Tích hợp với blockchain: Hoàn thành hợp đồng
    try {
      await this.completeContractOnBlockchain(saved);
      this.logger.log(
        `Contract ${saved.contractCode} completed on blockchain successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to complete contract ${saved.contractCode} on blockchain:`,
        error,
      );
      await this.markForBlockchainSync(saved.id, 'COMPLETE_CONTRACT');
    }

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

  // ================================
  // Blockchain Integration Methods
  // ================================

  /**
   * Tạo contract trên blockchain
   */
  private async createContractOnBlockchain(contract: Contract): Promise<void> {
    try {
      // Load thông tin đầy đủ từ DB
      const fullContract = await this.contractRepository.findOne({
        where: { id: contract.id },
        relations: ['tenant', 'landlord', 'property'],
      });

      if (!fullContract) {
        throw new Error('Contract not found for blockchain sync');
      }
      const property = fullContract.property;
      if (!property) {
        throw new Error('Property info missing for blockchain sync');
      }
      // Tạo document hash và signature metadata
      // Là mã hash file pdf đã có chữ ký landlord
      const documentHash = await this.generateDocumentHash(fullContract);
      const landlordSignatureMeta = JSON.stringify({ algorithm: 'RSA-SHA256' });

      // Tạo FabricUser cho landlord (người tạo contract)
      const fabricUser = this.createFabricUser(
        fullContract.landlord.id,
        'OrgLandlordMSP',
      );

      const contractData = {
        contractId: fullContract.contractCode,
        landlordId: fullContract.landlord.id,
        tenantId: fullContract.tenant.id,
        landlordMSP: 'OrgLandlordMSP',
        tenantMSP: 'OrgTenantMSP',
        landlordCertId: `${fullContract.landlord.id}-cert`,
        tenantCertId: `${fullContract.tenant.id}-cert`,
        signedContractFileHash: documentHash,
        landlordSignatureMeta,
        rentAmount: property.price.toString(), // Default rent amount - should come from property
        depositAmount: property.price.toString(), // Default deposit amount - should come from property
        currency: 'VND',
        startDate: fullContract.startDate.toISOString(),
        endDate: fullContract.endDate.toISOString(),
      };

      await this.blockchainService.createContract(contractData, fabricUser);

      this.logger.log(
        `✅ Contract ${fullContract.contractCode} created on blockchain`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to create contract on blockchain:`, error);
      throw error;
    }
  }

  /**
   * Tenant ký contract trên blockchain
   */
  private async tenantSignContractOnBlockchain(
    contract: Contract,
  ): Promise<void> {
    try {
      // Tạo document hash và signature metadata
      // Là mã hash file pdf đã có chữ ký landlord
      const documentHash = await this.generateDocumentHash(contract);
      const tenantSignatureMeta = JSON.stringify({ algorithm: 'RSA-SHA256' });

      // Tạo FabricUser cho tenant
      const fabricUser = this.createFabricUser(
        contract.tenant.id,
        'OrgTenantMSP',
      );

      await this.blockchainService.tenantSignContract(
        contract.contractCode,
        `full_${documentHash}`,
        tenantSignatureMeta,
        fabricUser,
      );

      this.logger.log(
        `✅ Contract ${contract.contractCode} signed by tenant on blockchain`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to sign contract on blockchain:`, error);
      throw error;
    }
  }

  /**
   * Kích hoạt contract trên blockchain (sau khi deposit được funding)
   */
  private async activateContractOnBlockchain(
    contract: Contract,
  ): Promise<void> {
    try {
      // Tạo FabricUser cho landlord (người kích hoạt)
      const fabricUser = this.createFabricUser(
        contract.landlord.id,
        'OrgLandlordMSP',
      );

      await this.blockchainService.activateContract(
        contract.contractCode,
        fabricUser,
      );

      this.logger.log(
        `✅ Contract ${contract.contractCode} activated on blockchain`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to activate contract on blockchain:`, error);
      throw error;
    }
  }

  /**
   * Hoàn thành contract trên blockchain
   */
  private async completeContractOnBlockchain(
    contract: Contract,
  ): Promise<void> {
    try {
      // Tạo FabricUser cho landlord
      const fabricUser = this.createFabricUser(
        contract.landlord.id,
        'OrgLandlordMSP',
      );

      // Sử dụng terminateContract với reason là "COMPLETED"
      await this.blockchainService.terminateContract(
        contract.contractCode,
        'COMPLETED',
        fabricUser,
      );

      this.logger.log(
        `✅ Contract ${contract.contractCode} completed on blockchain`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to complete contract on blockchain:`, error);
      throw error;
    }
  }

  /**
   * Tạo payment schedule trên blockchain sau khi contract active
   */
  private async createPaymentScheduleOnBlockchain(
    contract: Contract,
  ): Promise<void> {
    try {
      // Tạo FabricUser cho landlord (người quản lý contract)
      const fabricUser = this.createFabricUser(
        contract.landlord.id,
        'OrgLandlordMSP',
      );

      await this.blockchainService.createMonthlyPaymentSchedule(
        contract.contractCode,
        fabricUser,
      );

      this.logger.log(
        `✅ Payment schedule created on blockchain for contract ${contract.contractCode}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to create payment schedule on blockchain:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Đánh dấu contract cần đồng bộ lại với blockchain (compensation mechanism)
   */
  private async markForBlockchainSync(
    contractId: string,
    operation: string,
  ): Promise<void> {
    try {
      // TODO: Lưu vào queue hoặc bảng retry để xử lý sau
      this.logger.warn(
        `🔄 Contract ${contractId} marked for blockchain sync: ${operation}`,
      );

      // Có thể implement với Redis queue hoặc database table
      // await this.retryQueueService.addRetryJob({
      //   type: 'BLOCKCHAIN_SYNC',
      //   contractId,
      //   operation,
      //   attempts: 0,
      //   maxAttempts: 3,
      //   createdAt: new Date()
      // });
    } catch (error) {
      this.logger.error('Failed to mark contract for blockchain sync:', error);
    }
  }

  /**
   * Tạo document hash cho contract
   */
  private async generateDocumentHash(contract: Contract): Promise<string> {
    const contractData = {
      contractCode: contract.contractCode,
      landlordId: contract.landlord?.id,
      tenantId: contract.tenant?.id,
      propertyId: contract.property?.id,
      startDate: contract.startDate?.toISOString(),
      endDate: contract.endDate?.toISOString(),
      status: contract.status,
    };

    const dataString = JSON.stringify(contractData);
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Tạo FabricUser object cho blockchain operations
   */
  private createFabricUser(userId: string, orgMSP: string): FabricUser {
    return {
      userId: userId,
      orgName:
        orgMSP === 'OrgLandlordMSP'
          ? 'OrgLandlord'
          : orgMSP === 'OrgTenantMSP'
            ? 'OrgTenant'
            : 'OrgProp',
      mspId: orgMSP,
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
