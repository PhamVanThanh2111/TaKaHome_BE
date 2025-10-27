/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { addMonths as addMonthsFn } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Repository } from 'typeorm';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';
import { BlockchainService } from '../blockchain/blockchain.service';
import { FabricUser } from '../blockchain/interfaces/fabric.interface';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Contract } from './entities/contract.entity';
import { ExtensionStatus } from './entities/contract-extension.entity';
import {
  ContractTerminationService,
  TerminationResult,
} from './contract-termination.service';
import {
  DisputeHandlingService,
  DisputeDetails,
} from './dispute-handling.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private blockchainService: BlockchainService,
    private s3StorageService: S3StorageService,
    private terminationService: ContractTerminationService,
    private disputeService: DisputeHandlingService,
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
    roomId?: string;
    startDate?: Date;
    endDate?: Date;
    contractCode?: string;
    contractFileUrl?: string;
  }): Promise<Contract> {
    const start = input.startDate ? this.toDate(input.startDate) : vnNow();
    const proposedEnd = input.endDate
      ? this.toDate(input.endDate)
      : this.addHours(start, 60); // Demo: default 60 "hours" instead of months
    // : this.addMonths(start, 12);
    // const end = proposedEnd > start ? proposedEnd : this.addMonths(start, 12);
    const end = proposedEnd > start ? proposedEnd : this.addHours(start, 60); // Demo: default 60 "hours" instead of months
    //Demo
    const contract = this.contractRepository.create({
      contractCode:
        input.contractCode ?? (await this.generateContractCode(start)),
      tenant: { id: input.tenantId } as unknown as Contract['tenant'],
      landlord: { id: input.landlordId } as unknown as Contract['landlord'],
      property: { id: input.propertyId } as unknown as Contract['property'],
      room: input.roomId
        ? ({ id: input.roomId } as unknown as Contract['room'])
        : undefined,
      startDate: start,
      endDate: end,
      status: ContractStatusEnum.DRAFT,
      contractFileUrl: input.contractFileUrl,
    });

    const savedContract = await this.contractRepository.save(contract);

    // Note: Blockchain integration moved to markPendingSignatureWithBlockchain()
    // which is called after landlord approves and signs PDF successfully

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
  //Demo
  private addHours(base: Date, hours: number): Date {
    const result = new Date(base);
    result.setHours(result.getHours() + hours);
    return result;
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

  /**
   * Cập nhật contract thành PENDING_SIGNATURE và tích hợp blockchain
   * Được gọi sau khi landlord approve và ký PDF thành công
   */
  async markPendingSignatureWithBlockchain(
    id: string,
    contractFileUrl?: string,
  ): Promise<ResponseCommon<Contract>> {
    const contract = await this.loadContractOrThrow(id);
    this.ensureStatus(contract, [ContractStatusEnum.DRAFT]);

    // Cập nhật status và contractFileUrl nếu có
    contract.status = ContractStatusEnum.PENDING_SIGNATURE;
    if (contractFileUrl) {
      contract.contractFileUrl = contractFileUrl;
    }

    const saved = await this.contractRepository.save(contract);

    // Tích hợp với blockchain: Tạo contract trên blockchain
    try {
      // await this.createContractOnBlockchain(saved);
      this.logger.log(
        `Contract ${saved.contractCode} created on blockchain successfully after landlord approval`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create contract ${saved.contractCode} on blockchain after landlord approval:`,
        error,
      );
      // Đánh dấu contract cần đồng bộ lại với blockchain
      await this.markForBlockchainSync(saved.id, 'CREATE_CONTRACT');
    }

    return new ResponseCommon(200, 'SUCCESS', saved);
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

  async updateSignatureTransactionId(
    id: string,
    transactionId: string,
    signatureIndex: number,
  ): Promise<void> {
    const contract = await this.loadContractOrThrow(id);

    if (signatureIndex === 0) {
      // LANDLORD signing (signatureIndex: 0)
      contract.transactionIdLandlordSign = transactionId;
    } else if (signatureIndex === 1) {
      // TENANT signing (signatureIndex: 1)
      contract.transactionIdTenantSign = transactionId;
    } else {
      this.logger.warn(`Invalid signatureIndex: ${signatureIndex}`);
      return;
    }

    await this.contractRepository.save(contract);
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

  /**
   * Lấy URL truy cập file hợp đồng từ S3
   * Chỉ cho phép tenant hoặc landlord của hợp đồng truy cập
   * Trả về cả URL hợp đồng ban đầu và các URL hợp đồng gia hạn
   */
  async getContractFileUrl(
    contractId: string,
    userId: string,
  ): Promise<
    ResponseCommon<{
      fileUrl: string;
      extensionFileUrls: Array<{
        extensionId: string;
        fileUrl: string;
        createdAt: Date;
      }>;
    }>
  > {
    // Tìm hợp đồng với thông tin tenant, landlord và extensions
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'landlord', 'extensions'],
    });

    if (!contract) {
      throw new NotFoundException('Không tìm thấy hợp đồng');
    }

    // Kiểm tra contractFileUrl có tồn tại không
    if (!contract.contractFileUrl) {
      throw new NotFoundException('Hợp đồng chưa có file đính kèm');
    }

    // Kiểm tra quyền truy cập: chỉ tenant hoặc landlord của hợp đồng mới được phép
    const isTenant = contract.tenant?.id === userId;
    const isLandlord = contract.landlord?.id === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException('Bạn không có quyền truy cập hợp đồng này');
    }

    try {
      // Helper function để tạo presigned URL từ S3 URL
      const generatePresignedUrl = async (s3Url: string): Promise<string> => {
        const url = new URL(s3Url);
        const key = url.pathname.substring(1); // Bỏ dấu "/" đầu tiên
        return await this.s3StorageService.getPresignedGetUrl(key, 900);
      };

      // Tạo presigned URL cho hợp đồng ban đầu
      const mainContractPresignedUrl = await generatePresignedUrl(
        contract.contractFileUrl,
      );

      // Lấy và sắp xếp các extension theo createdAt (mới nhất đầu tiên)
      const sortedExtensions = (contract.extensions || [])
        .filter((ext) => ext.extensionContractFileUrl) // Chỉ lấy extension có file
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Mới nhất trước

      // Tạo presigned URL cho các extension
      const extensionFileUrls = await Promise.all(
        sortedExtensions.map(async (extension) => {
          const presignedUrl = await generatePresignedUrl(
            extension.extensionContractFileUrl!,
          );
          return {
            extensionId: extension.id,
            fileUrl: presignedUrl,
            createdAt: extension.createdAt,
          };
        }),
      );

      return new ResponseCommon(200, 'SUCCESS', {
        fileUrl: mainContractPresignedUrl,
        extensionFileUrls,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for contract ${contractId}:`,
        error,
      );
      throw new BadRequestException('Không thể tạo URL truy cập file hợp đồng');
    }
  }

  async findRawById(id: string): Promise<Contract | null> {
    return this.contractRepository.findOne({
      where: { id },
      relations: ['tenant', 'landlord', 'property', 'extensions'],
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
        relations: ['tenant', 'landlord', 'property', 'room', 'room.roomType'],
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
      const landlordSignatureMeta = this.generateSimpleSignatureMeta(
        fullContract,
        0,
        'landlord',
      );

      // Tạo FabricUser cho landlord (người tạo contract)
      const fabricUser = this.createFabricUser(
        fullContract.landlord.id,
        'OrgLandlordMSP',
      );

      const pricing = await this.getCurrentContractPricing(contract.id);

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
        rentAmount: pricing.monthlyRent.toString(),
        depositAmount: fullContract.room
          ? fullContract.room.roomType.deposit.toString()
          : (property.deposit ?? 0).toString(),
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
      // Là mã hash file pdf đã có chữ ký của cả landlord và tenant
      const documentHash = await this.generateDocumentHash(contract);
      const tenantSignatureMeta = this.generateSimpleSignatureMeta(
        contract,
        1,
        'tenant',
      );

      // Tạo FabricUser cho tenant
      const fabricUser = this.createFabricUser(
        contract.tenant.id,
        'OrgTenantMSP',
      );

      await this.blockchainService.tenantSignContract(
        contract.contractCode,
        documentHash,
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
   * Tạo signature metadata đơn giản và ngắn gọn
   * Không cần parse PDF phức tạp, chỉ dùng thông tin có sẵn
   */
  private generateSimpleSignatureMeta(
    contract: Contract,
    signatureIndex = 0,
    signerRole: 'landlord' | 'tenant' = 'landlord',
  ): string {
    const timestamp = new Date().toISOString();
    const signerInfo =
      signatureIndex === 0
        ? {
            role: 'landlord',
            userId: contract.landlord?.id,
            name: 'Landlord Digital Signature',
          }
        : {
            role: 'tenant',
            userId: contract.tenant?.id,
            name: 'Tenant Digital Signature',
          };

    const metadata = {
      algorithm: 'RSA-SHA256',
      source: 'SmartCA-VNPT',
      signatureIndex,
      timestamp,
      signer: {
        role: signerInfo.role,
        userId: signerInfo.userId,
        name: signerInfo.name,
      },
      contract: {
        code: contract.contractCode,
        status: contract.status,
      },
      fileUrl: contract.contractFileUrl ? 'available' : 'not-available',
    };

    this.logger.log(
      `🔐 Generated simple signature metadata for contract ${contract.contractCode}, ${signerInfo.role} signature`,
    );

    return JSON.stringify(metadata);
  }

  /**
   * Tạo document hash cho contract
   * Ưu tiên hash từ file PDF đã ký, fallback về metadata nếu không có file
   */
  private async generateDocumentHash(contract: Contract): Promise<string> {
    // Nếu có contractFileUrl (file PDF đã ký), hash từ file thực tế
    if (contract.contractFileUrl) {
      try {
        // Extract S3 key từ URL và download file
        const s3Key = this.s3StorageService.extractKeyFromUrl(
          contract.contractFileUrl,
        );
        const pdfBuffer = await this.s3StorageService.downloadFile(s3Key);

        // Hash toàn bộ file PDF đã ký
        const fileHash = crypto
          .createHash('sha256')
          .update(pdfBuffer)
          .digest('hex');

        this.logger.log(
          `📄 Generated hash from signed PDF file for contract ${contract.contractCode}: ${fileHash.substring(0, 16)}...`,
        );
        return fileHash;
      } catch (error) {
        this.logger.warn(
          `⚠️ Failed to hash PDF file for contract ${contract.contractCode}, falling back to metadata hash:`,
          error instanceof Error ? error.message : error,
        );
        // Fallback về hash metadata nếu không thể download file
      }
    }

    // Fallback: Hash từ contract metadata (như cũ)
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
    const metadataHash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');

    this.logger.log(
      `📋 Generated hash from contract metadata for contract ${contract.contractCode}: ${metadataHash.substring(0, 16)}...`,
    );
    return metadataHash;
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

  /**
   * Terminate contract with proper refund calculation
   */
  async terminateContract(
    id: string,
    reason: string,
    terminatedBy: string,
  ): Promise<ResponseCommon<TerminationResult>> {
    try {
      const contract = await this.loadContractOrThrow(id);

      // Validate contract can be terminated
      this.ensureStatus(contract, [
        ContractStatusEnum.ACTIVE,
        ContractStatusEnum.SIGNED,
      ]);

      const result = await this.terminationService.terminateContract(
        id,
        reason,
        terminatedBy,
      );

      return new ResponseCommon(200, 'SUCCESS', result);
    } catch (error) {
      this.logger.error(`Failed to terminate contract ${id}:`, error);
      throw new BadRequestException(
        `Contract termination failed: ${error.message}`,
      );
    }
  }

  /**
   * Raise a dispute for a contract
   */
  async raiseDispute(
    contractId: string,
    disputeReason: string,
    initiatedBy: 'tenant' | 'landlord' = 'tenant',
    disputeType:
      | 'PAYMENT'
      | 'PROPERTY_CONDITION'
      | 'CONTRACT_VIOLATION'
      | 'EARLY_TERMINATION'
      | 'OTHER' = 'OTHER',
  ): Promise<ResponseCommon<DisputeDetails>> {
    try {
      const contract = await this.loadContractOrThrow(contractId);

      // Validate contract status
      this.ensureStatus(contract, [
        ContractStatusEnum.ACTIVE,
        ContractStatusEnum.SIGNED,
      ]);

      const disputeDetails = await this.disputeService.raiseDispute(
        contractId,
        disputeReason,
        initiatedBy,
        disputeType,
      );

      return new ResponseCommon(200, 'SUCCESS', disputeDetails);
    } catch (error) {
      this.logger.error(
        `Failed to raise dispute for contract ${contractId}:`,
        error,
      );
      throw new BadRequestException(
        `Dispute creation failed: ${error.message}`,
      );
    }
  }

  /**
   * Resolve a dispute for a contract
   */
  async resolveDispute(
    contractId: string,
    resolution: string,
    resolvedBy: string,
    outcome:
      | 'TENANT_FAVOR'
      | 'LANDLORD_FAVOR'
      | 'MUTUAL_AGREEMENT'
      | 'DISMISSED',
  ): Promise<ResponseCommon<boolean>> {
    try {
      const contract = await this.loadContractOrThrow(contractId);

      const resolved = await this.disputeService.resolveDispute(
        contractId,
        resolution,
        resolvedBy,
        outcome,
      );

      return new ResponseCommon(200, 'SUCCESS', resolved);
    } catch (error) {
      this.logger.error(
        `Failed to resolve dispute for contract ${contractId}:`,
        error,
      );
      throw new BadRequestException(
        `Dispute resolution failed: ${error.message}`,
      );
    }
  }

  /**
   * Lấy giá hiện tại của contract, ưu tiên giá từ ContractExtension nếu có
   */
  async getCurrentContractPricing(contractId: string): Promise<{
    monthlyRent: number;
    electricityPrice?: number;
    waterPrice?: number;
  }> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['extensions', 'property', 'room', 'room.roomType'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Tìm extension được active gần nhất
    const activeExtension = contract.extensions
      ?.filter((ext) => ext.status === ExtensionStatus.ACTIVE)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (activeExtension && activeExtension.newMonthlyRent) {
      // Sử dụng giá từ ContractExtension
      return {
        monthlyRent: activeExtension.newMonthlyRent,
      };
    }

    // Sử dụng giá gốc từ Property/RoomType
    if (contract.room) {
      // BOARDING: Lấy giá từ RoomType
      return {
        monthlyRent: contract.room.roomType?.price || 0,
        electricityPrice: contract.property?.electricityPricePerKwh,
        waterPrice: contract.property?.waterPricePerM3,
      };
    } else {
      // HOUSING/APARTMENT: Lấy giá từ Property
      return {
        monthlyRent: contract.property?.price || 0,
        electricityPrice: contract.property?.electricityPricePerKwh,
        waterPrice: contract.property?.waterPricePerM3,
      };
    }
  }

  /**
   * Mark tenant extension escrow as funded
   */
  async markExtensionTenantEscrowFunded(extensionId: string): Promise<void> {
    const extension = await this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.extensions', 'extension')
      .where('extension.id = :extensionId', { extensionId })
      .getOne();

    const ext = extension?.extensions?.find((e) => e.id === extensionId);
    if (!ext) {
      throw new NotFoundException('Extension not found');
    }

    ext.tenantEscrowDepositFundedAt = vnNow();

    // Check if both escrows are funded
    if (ext.landlordEscrowDepositFundedAt) {
      ext.status = ExtensionStatus.ACTIVE;
      ext.activatedAt = vnNow();
      // Apply extension to contract
      await this.applyActiveExtension(extension!.id, ext);
    } else {
      ext.status = ExtensionStatus.ESCROW_FUNDED_T;
    }

    await this.contractRepository.manager
      .getRepository('ContractExtension')
      .save(ext);
  }

  /**
   * Mark landlord extension escrow as funded
   */
  async markExtensionLandlordEscrowFunded(extensionId: string): Promise<void> {
    const extension = await this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.extensions', 'extension')
      .where('extension.id = :extensionId', { extensionId })
      .getOne();

    const ext = extension?.extensions?.find((e) => e.id === extensionId);
    if (!ext) {
      throw new NotFoundException('Extension not found');
    }

    ext.landlordEscrowDepositFundedAt = vnNow();

    // Check if both escrows are funded
    if (ext.tenantEscrowDepositFundedAt) {
      ext.status = ExtensionStatus.ACTIVE;
      ext.activatedAt = vnNow();
      // Apply extension to contract
      await this.applyActiveExtension(extension!.id, ext);
    } else {
      ext.status = ExtensionStatus.ESCROW_FUNDED_L;
    }

    await this.contractRepository.manager
      .getRepository('ContractExtension')
      .save(ext);
  }

  /**
   * Apply active extension to contract (update endDate and pricing)
   */
  private async applyActiveExtension(
    contractId: string,
    extension: any,
  ): Promise<void> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Gia hạn contract
    const newEndDate = addMonthsFn(contract.endDate, extension.extensionMonths);
    contract.endDate = newEndDate;

    await this.contractRepository.save(contract);
  }
}
