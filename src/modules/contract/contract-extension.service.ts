import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContractExtension,
  ExtensionStatus,
} from './entities/contract-extension.entity';
import { Contract } from './entities/contract.entity';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { CreateContractExtensionDto } from './dto/create-contract-extension.dto';
import { RespondContractExtensionDto } from './dto/respond-contract-extension.dto';
import { TenantRespondExtensionDto } from './dto/tenant-respond-extension.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { vnNow, formatVN } from '../../common/datetime';
import { addMonths, addHours } from 'date-fns';
import { SmartCAService } from '../smartca/smartca.service';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { Escrow } from '../escrow/entities/escrow.entity';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import { User } from '../user/entities/user.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PdfFillService, PdfTemplateType } from './pdf-fill.service';
import * as crypto from 'crypto';
import { CONTRACT_ERRORS } from 'src/common/constants/error-messages.constant';

@Injectable()
export class ContractExtensionService {
  private readonly logger = new Logger(ContractExtensionService.name);

  constructor(
    @InjectRepository(ContractExtension)
    private extensionRepository: Repository<ContractExtension>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    private smartcaService: SmartCAService,
    private s3StorageService: S3StorageService,
    private blockchainService: BlockchainService,
    private pdfFillService: PdfFillService,
  ) {}

  async requestExtension(
    dto: CreateContractExtensionDto,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    // Kiểm tra contract tồn tại và thuộc về user
    const contract = await this.contractRepository.findOne({
      where: { id: dto.contractId },
      relations: ['tenant', 'landlord', 'property', 'room'],
    });

    if (!contract) {
      throw new NotFoundException(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }

    // Chỉ tenant mới có thể yêu cầu gia hạn
    if (contract.tenant.id !== userId) {
      throw new ForbiddenException(
        'Only tenant can request contract extension',
      );
    }

    // Contract phải đang ACTIVE
    if (contract.status !== ContractStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'Contract must be active to request extension',
      );
    }

    // còn thời hạn 2 dưới tháng thì cho phép gia hạn (Ví dụ như đầu tháng 6 hết hạn thì từ đầu tháng 4 mới được gia hạn)
    const now = vnNow();
    const twoMonthsBeforeEnd = addMonths(contract.endDate, -2);
    if (now < twoMonthsBeforeEnd || now > contract.endDate) {
      throw new BadRequestException(
        'Can only request extension within 2 months before contract end date',
      );
    }

    // Kiểm tra còn có extension đang pending không
    const pendingExtension = await this.extensionRepository.findOne({
      where: {
        contractId: dto.contractId,
        status: ExtensionStatus.PENDING,
      },
    });

    if (pendingExtension) {
      throw new BadRequestException(
        'There is already a pending extension request for this contract',
      );
    }

    // Kiểm tra nếu landlord đã từ chối 3 lần liên tiếp
    const recentExtensions = await this.extensionRepository.find({
      where: { contractId: dto.contractId },
      order: { createdAt: 'DESC' },
      take: 3, // Lấy 3 extension gần nhất
    });

    // Nếu có ít nhất 3 extension và tất cả đều bị REJECTED
    if (recentExtensions.length >= 3) {
      const allRejected = recentExtensions.every(
        (extension) => extension.status === ExtensionStatus.REJECTED,
      );

      if (allRejected) {
        throw new BadRequestException(
          'Cannot request extension. Landlord has rejected 3 consecutive extension requests for this contract. Please contact landlord directly.',
        );
      }
    }

    // Tạo extension request
    const extension = this.extensionRepository.create({
      ...dto,
    });

    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      'Extension request created successfully',
      saved,
    );
  }

  async respondToExtension(
    extensionId: string,
    dto: RespondContractExtensionDto,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    // Lấy extension với contract relation
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: [
        'contract',
        'contract.tenant',
        'contract.landlord',
        'contract.property',
        'contract.room',
      ],
    });

    if (!extension) {
      throw new NotFoundException(CONTRACT_ERRORS.EXTENSION_NOT_FOUND);
    }

    // Chỉ landlord mới có thể phản hồi
    if (extension.contract.landlord.id !== userId) {
      throw new ForbiddenException(
        'Only landlord can respond to extension request',
      );
    }

    // Extension phải đang pending
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException(CONTRACT_ERRORS.EXTENSION_REQUEST_NOT_PENDING);
    }

    // Cập nhật extension
    extension.status = dto.status;
    extension.responseNote = dto.responseNote;
    extension.respondedAt = vnNow();

    if (dto.status === ExtensionStatus.LANDLORD_RESPONDED) {
      // Cập nhật giá mới từ landlord
      if (dto.newMonthlyRent !== undefined) {
        extension.newMonthlyRent = dto.newMonthlyRent;
      }
    }

    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      'Extension request responded successfully',
      saved,
    );
  }

  async applyExtension(extension: ContractExtension): Promise<void> {
    const contract = extension.contract;

    // Gia hạn contract
    const newEndDate = addMonths(contract.endDate, extension.extensionMonths);
    contract.endDate = newEndDate;

    // Chỉ gia hạn contract, giá sẽ được lưu trong ContractExtension
    // Không thay đổi giá trong Property/RoomType để tránh ảnh hưởng đến các contract khác
    await this.contractRepository.save(contract);

    // Ghi nhận extension lên blockchain
    await this.recordExtensionToBlockchain(extension, contract);
  }

  /**
   * Ghi nhận extension lên blockchain và tạo payment schedule
   */
  private async recordExtensionToBlockchain(
    extension: ContractExtension,
    contract: Contract,
  ): Promise<void> {
    try {
      // Lấy giá thuê hiện tại
      let currentRentAmount = 0;
      if (
        contract.property.type === PropertyTypeEnum.BOARDING &&
        contract.room?.roomType
      ) {
        currentRentAmount = contract.room.roomType.price;
      } else if (contract.property.price) {
        currentRentAmount = contract.property.price;
      }

      // Lấy giá thuê mới (nếu có thay đổi)
      const newRentAmount = extension.newMonthlyRent || currentRentAmount;

      // Xác định user để thực hiện giao dịch blockchain
      // Sử dụng landlord làm người thực hiện giao dịch
      const blockchainUser = {
        userId: contract.landlord.id,
        orgName: 'OrgLandlord',
        mspId: 'OrgLandlordMSP',
      };

      // Bước 1: Ghi nhận extension lên blockchain
      console.log(
        '[BlockchainExtension] 📝 Recording extension to blockchain...',
      );

      const recordResult = await this.blockchainService.recordContractExtension(
        contract.contractCode,
        addHours(extension.createdAt, 72).toISOString(),
        newRentAmount.toString(), // newRentAmount
        (await this.hashExtensionDocument(extension)) || '', // extensionAgreementHash (URL của hợp đồng gia hạn)
        extension.requestNote || 'Contract extension', // extensionNotes
        blockchainUser,
      );

      if (!recordResult.success) {
        throw new Error(
          `Failed to record extension to blockchain: ${recordResult.error}`,
        );
      }

      console.log(
        '[BlockchainExtension] ✅ Extension recorded successfully:',
        recordResult.data,
      );

      // Lấy extension number từ kết quả
      const extensionNumber = recordResult.data?.currentExtensionNumber;

      if (!extensionNumber) {
        throw new Error('Extension number not returned from blockchain');
      }

      // Bước 2: Tạo payment schedule cho extension
      console.log(
        `[BlockchainExtension] 📅 Creating payment schedule for extension ${extensionNumber}...`,
      );
      const scheduleResult =
        await this.blockchainService.createExtensionPaymentSchedule(
          contract.contractCode,
          extensionNumber.toString(),
          blockchainUser,
        );

      if (!scheduleResult.success) {
        throw new Error(
          `Failed to create extension payment schedule: ${scheduleResult.error}`,
        );
      }

      const schedulesCreated = scheduleResult.data?.length || 0;

      console.log(
        `[BlockchainExtension] ✅ Payment schedule created successfully: ${schedulesCreated} periods`,
      );

      // Log thông tin blockchain để audit
      console.log(
        '[BlockchainExtension] 🎉 Blockchain integration completed:',
        {
          contractId: contract.id,
          extensionId: extension.id,
          extensionNumber: extensionNumber,
          newEndDate: contract.endDate.toISOString(),
          newRentAmount: newRentAmount,
          paymentPeriodsCreated: schedulesCreated,
        },
      );
    } catch (error) {
      // Log error nhưng không fail transaction
      // Extension vẫn được apply trong database
      console.error(
        '[BlockchainExtension] ❌ Failed to record to blockchain:',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          contractId: contract.id,
          extensionId: extension.id,
          stack: error instanceof Error ? error.stack : undefined,
        },
      );

      // Có thể throw error nếu muốn fail cả transaction
      // throw new BadRequestException(
      //   `Failed to record extension to blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      // );

      // Hoặc chỉ log warning và tiếp tục
      console.warn(
        '[BlockchainExtension] ⚠️ Extension applied to database but blockchain record failed',
      );
    }
  }
  async hashExtensionDocument(extension: ContractExtension): Promise<string> {
    // Nếu có contractFileUrl (file PDF đã ký), hash từ file thực tế
    if (extension.extensionContractFileUrl) {
      try {
        // Extract S3 key từ URL và download file
        const s3Key = this.s3StorageService.extractKeyFromUrl(
          extension.extensionContractFileUrl,
        );
        const pdfBuffer = await this.s3StorageService.downloadFile(s3Key);

        // Hash toàn bộ file PDF đã ký
        const fileHash = crypto
          .createHash('sha256')
          .update(pdfBuffer)
          .digest('hex');

        this.logger.log(
          `📄 Generated hash from signed PDF file for contract ${extension.contract.contractCode}: ${fileHash.substring(0, 16)}...`,
        );
        return fileHash;
      } catch (error) {
        this.logger.warn(
          `⚠️ Failed to hash PDF file for contract ${extension.contract.contractCode}, falling back to metadata hash:`,
          error instanceof Error ? error.message : error,
        );
        // Fallback về hash metadata nếu không thể download file
      }
    }

    // Fallback: Hash từ contract metadata (như cũ)
    const contractData = {
      contractCode: extension.contract.contractCode,
      landlordId: extension.contract.landlord?.id,
      tenantId: extension.contract.tenant?.id,
      propertyId: extension.contract.property?.id,
      startDate: extension.contract.startDate?.toISOString(),
      endDate: extension.contract.endDate?.toISOString(),
      status: extension.contract.status,
    };

    const dataString = JSON.stringify(contractData);
    const metadataHash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');

    this.logger.log(
      `📋 Generated hash from contract metadata for contract ${extension.contract.contractCode}: ${metadataHash.substring(0, 16)}...`,
    );
    return metadataHash;
  }
  async getContractExtensions(
    contractId: string,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension[]>> {
    // Kiểm tra user có quyền xem extension của contract này không
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'landlord'],
    });

    if (!contract) {
      throw new NotFoundException(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }

    if (contract.tenant.id !== userId && contract.landlord.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view extensions for this contract',
      );
    }

    const extensions = await this.extensionRepository.find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(
      200,
      'Extensions retrieved successfully',
      extensions,
    );
  }

  /**
   * Lấy danh sách contract extensions với contractId làm tham số body
   */
  async getExtensionsByContractId(
    contractId: string,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension[]>> {
    // Kiểm tra contract tồn tại
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'landlord'],
    });

    if (!contract) {
      throw new NotFoundException(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }

    // Kiểm tra user có liên quan đến contract này không (có thể là TENANT hoặc LANDLORD)
    const isRelatedUser =
      contract.tenant.id === userId || contract.landlord.id === userId;

    if (!isRelatedUser) {
      throw new ForbiddenException(
        'You do not have permission to view extensions for this contract. Only tenant or landlord can access this information.',
      );
    }

    // Lấy danh sách extensions của contract này
    const extensions = await this.extensionRepository.find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(
      200,
      'Contract extensions retrieved successfully',
      extensions,
    );
  }

  async cancelExtension(
    extensionId: string,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant'],
    });

    if (!extension) {
      throw new NotFoundException(CONTRACT_ERRORS.EXTENSION_NOT_FOUND);
    }

    // Chỉ tenant (người tạo extension) mới có thể cancel
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException(CONTRACT_ERRORS.ONLY_TENANT_CAN_CANCEL);
    }

    // Chỉ có thể cancel khi đang pending
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException(
        'Can only cancel pending extension requests',
      );
    }

    extension.status = ExtensionStatus.CANCELLED;
    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      'Extension request cancelled successfully',
      saved,
    );
  }

  async tenantRespondToExtension(
    extensionId: string,
    dto: TenantRespondExtensionDto,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant'],
    });

    if (!extension) {
      throw new NotFoundException(CONTRACT_ERRORS.EXTENSION_NOT_FOUND);
    }

    // Chỉ đúng tenant mới có thể đồng ý/từ chối
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException(CONTRACT_ERRORS.ONLY_TENANT_CAN_RESPOND);
    }

    // Extension phải đang ở trạng thái LANDLORD_RESPONDED
    if (extension.status !== ExtensionStatus.LANDLORD_RESPONDED) {
      throw new BadRequestException(
        'Extension must be in LANDLORD_RESPONDED status',
      );
    }

    // Cập nhật trạng thái
    extension.status = dto.status;
    if (dto.note) {
      extension.requestNote = extension.requestNote
        ? `${extension.requestNote}\n\n[Tenant response]: ${dto.note}`
        : `[Tenant response]: ${dto.note}`;
    }

    // Nếu tenant đồng ý, chuyển sang trạng thái chờ ký hợp đồng
    if (dto.status === ExtensionStatus.AWAITING_SIGNATURES) {
      extension.status = ExtensionStatus.AWAITING_SIGNATURES;
    } else if (dto.status === ExtensionStatus.REJECTED) {
      extension.status = ExtensionStatus.REJECTED;
    } else {
      throw new BadRequestException('Invalid extension status from tenant');
    }

    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      dto.status === ExtensionStatus.AWAITING_SIGNATURES
        ? 'Extension approved, ready for signing'
        : 'Extension rejected successfully',
      saved,
    );
  }

  /**
   * Landlord ký hợp đồng gia hạn
   */
  async landlordSignExtension(
    extensionId: string,
    userId: string,
    signingOption?: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant', 'contract.landlord'],
    });

    if (!extension) {
      throw new NotFoundException(CONTRACT_ERRORS.EXTENSION_NOT_FOUND);
    }

    // Chỉ landlord mới có thể ký
    if (extension.contract.landlord.id !== userId) {
      throw new ForbiddenException(CONTRACT_ERRORS.ONLY_LANDLORD_CAN_SIGN);
    }

    // Extension phải ở trạng thái AWAITING_SIGNATURES
    if (extension.status !== ExtensionStatus.AWAITING_SIGNATURES) {
      throw new BadRequestException(
        'Extension is not ready for landlord signing',
      );
    }

    try {
      // Build field values and fill the extension PDF template (PhuLucHopDongGiaHan)
      const landlord = await this.userRepository.findOne({
        where: { id: userId },
      });

      const now = vnNow();
      const fieldValues: Record<string, string> = {};
      fieldValues.date = formatVN(now, 'dd/MM/yyyy');

      // Landlord / Tenant info
      if (extension.contract?.landlord?.fullName) {
        fieldValues.landlord_name = extension.contract.landlord.fullName;
        fieldValues.landlord_sign = extension.contract.landlord.fullName;
      }
      if (extension.contract?.landlord?.CCCD) {
        fieldValues.landlord_cccd = extension.contract.landlord.CCCD;
      }
      if (extension.contract?.tenant?.fullName) {
        fieldValues.tenant_name = extension.contract.tenant.fullName;
        fieldValues.tenant_sign = extension.contract.tenant.fullName;
      }
      if (extension.contract?.tenant?.CCCD) {
        fieldValues.tenant_cccd = extension.contract.tenant.CCCD;
      }

      // Original contract dates
      if (extension.contract?.startDate) {
        fieldValues.contract_start = formatVN(
          extension.contract.startDate,
          'dd/MM/yyyy',
        );
      }
      if (extension.contract?.endDate) {
        fieldValues.contract_end = formatVN(
          extension.contract.endDate,
          'dd/MM/yyyy',
        );
      }

      // Extension-specific fields
      fieldValues.extension_months = String(extension.extensionMonths ?? '');
      if (
        extension.newMonthlyRent !== undefined &&
        extension.newMonthlyRent !== null
      ) {
        fieldValues.new_monthly_rent = String(extension.newMonthlyRent);
      }

      // Fill and flatten the extension PDF template
      const filledPdfBuffer = await this.pdfFillService.fillPdfTemplate(
        fieldValues,
        PdfTemplateType.PHU_LUC_HOP_DONG_GIA_HAN,
        true, // flatten before signing per requirement
      );

      // Landlord ký hợp đồng gia hạn (signatureIndex: 0)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer: filledPdfBuffer,
        signatureIndex: 0,
        userIdOverride:
          (signingOption ?? 'SELF_CA').toUpperCase() === 'SELF_CA'
            ? userId
            : landlord?.CCCD,
        contractId: extension.contract.id,
        intervalMs: 1000,
        timeoutMs: 60000,
        reason: 'Contract Extension Landlord Signature',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Landlord Extension Signature',
        creator: 'SmartCA VNPT 2025',
        signingOption: signingOption ?? 'SELF_CA',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Landlord extension signing failed: ${signResult.error}`,
        );
      }

      let signedPdfPresignedUrl: string | undefined;

      // Upload signed PDF to S3
      if (signResult.signedPdf) {
        const uploadResult = await this.s3StorageService.uploadContractPdf(
          signResult.signedPdf,
          {
            contractId: extension.contract.id,
            role: 'LANDLORD',
            signatureIndex: 0,
            filenameSuffix: '-extension',
            metadata: {
              extensionId: extension.id,
              transactionId: signResult.transactionId || '',
              docId: signResult.docId || '',
              uploadedBy: 'system',
              signedAt: new Date().toISOString(),
              contractType: 'extension',
            },
          },
        );

        signedPdfPresignedUrl = await this.s3StorageService.getPresignedGetUrl(
          uploadResult.key,
          300,
        );

        extension.extensionContractFileUrl = uploadResult.url;
      }

      // Cập nhật extension
      extension.status = ExtensionStatus.LANDLORD_SIGNED;
      extension.landlordSignedAt = vnNow();
      extension.transactionIdLandlordSign = signResult.transactionId;

      const saved = await this.extensionRepository.save(extension);

      return new ResponseCommon(200, 'Landlord signed extension successfully', {
        ...saved,
        signedPdfUrl: signedPdfPresignedUrl,
      });
    } catch (error) {
      console.error('[LandlordSignExtension] ❌ Failed:', error);
      throw new BadRequestException(
        `Failed to complete landlord extension signing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Tenant ký hợp đồng gia hạn
   */
  async tenantSignExtension(
    extensionId: string,
    userId: string,
    signingOption?: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: [
        'contract',
        'contract.tenant',
        'contract.landlord',
        'contract.property',
        'contract.room',
        'contract.room.roomType',
      ],
    });

    if (!extension) {
      throw new NotFoundException(CONTRACT_ERRORS.EXTENSION_NOT_FOUND);
    }

    // Chỉ tenant mới có thể ký
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException(CONTRACT_ERRORS.ONLY_TENANT_CAN_SIGN);
    }

    // Extension phải ở trạng thái LANDLORD_SIGNED
    if (extension.status !== ExtensionStatus.LANDLORD_SIGNED) {
      throw new BadRequestException(
        'Landlord must sign the extension contract first',
      );
    }

    if (!extension.extensionContractFileUrl) {
      throw new BadRequestException(
        'Extension contract file URL not found. Landlord must sign first.',
      );
    }

    try {
      // Download landlord-signed PDF from S3
      const s3Key = this.s3StorageService.extractKeyFromUrl(
        extension.extensionContractFileUrl,
      );
      const landlordSignedPdf = await this.s3StorageService.downloadFile(s3Key);

      const tenant = await this.userRepository.findOne({
        where: { id: userId },
      });

      // Tenant ký hợp đồng gia hạn (signatureIndex: 1)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer: landlordSignedPdf,
        signatureIndex: 1,
        userIdOverride:
          (signingOption ?? 'SELF_CA').toUpperCase() === 'SELF_CA'
            ? userId
            : tenant?.CCCD,
        contractId: extension.contract.id,
        intervalMs: 1000,
        timeoutMs: 60000,
        reason: 'Contract Extension Tenant Signature',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Tenant Extension Signature',
        creator: 'SmartCA VNPT 2025',
        signingOption: signingOption ?? 'SELF_CA',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Tenant extension signing failed: ${signResult.error}`,
        );
      }

      let signedPdfPresignedUrl: string | undefined;

      // Upload fully-signed PDF to S3
      if (signResult.signedPdf) {
        const uploadResult = await this.s3StorageService.uploadContractPdf(
          signResult.signedPdf,
          {
            contractId: extension.contract.id,
            role: 'TENANT',
            signatureIndex: 1,
            filenameSuffix: '-extension',
            metadata: {
              extensionId: extension.id,
              transactionId: signResult.transactionId || '',
              docId: signResult.docId || '',
              uploadedBy: 'system',
              signedAt: new Date().toISOString(),
              contractType: 'extension',
              fullySignedExtension: 'true',
            },
          },
        );

        signedPdfPresignedUrl = await this.s3StorageService.getPresignedGetUrl(
          uploadResult.key,
          300,
        );

        extension.extensionContractFileUrl = uploadResult.url;
      }

      // Cập nhật extension và kiểm tra ký quỹ
      extension.tenantSignedAt = vnNow();
      extension.transactionIdTenantSign = signResult.transactionId;

      // Kiểm tra số tiền ký quỹ hiện tại và yêu cầu
      await this.checkAndUpdateEscrowStatus(extension);

      const saved = await this.extensionRepository.save(extension);

      return new ResponseCommon(200, 'Tenant signed extension successfully', {
        ...saved,
        signedPdfUrl: signedPdfPresignedUrl,
      });
    } catch (error) {
      console.error('[TenantSignExtension] ❌ Failed:', error);
      throw new BadRequestException(
        `Failed to complete tenant extension signing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Kiểm tra và cập nhật trạng thái ký quỹ dựa trên số dư hiện tại
   */
  private async checkAndUpdateEscrowStatus(
    extension: ContractExtension,
  ): Promise<void> {
    const contract = extension.contract;

    // Lấy thông tin ký quỹ hiện tại
    const escrowAccount = await this.escrowRepository.findOne({
      where: { contractId: contract.id },
    });

    if (!escrowAccount) {
      throw new BadRequestException(
        'Escrow account not found for this contract',
      );
    }

    // Xác định số tiền ký quỹ yêu cầu dựa trên loại property
    let requiredDeposit = 0;

    if (contract.property.type === PropertyTypeEnum.BOARDING) {
      // Với BOARDING, lấy deposit từ RoomType
      if (contract.room?.roomType?.deposit) {
        requiredDeposit = contract.room.roomType.deposit;
      }
    } else {
      // Với HOUSING hoặc APARTMENT, lấy deposit từ Property
      if (contract.property.deposit) {
        requiredDeposit = contract.property.deposit;
      }
    }

    if (requiredDeposit === 0) {
      throw new BadRequestException(
        'Deposit amount not configured for this property',
      );
    }

    // Chuyển đổi số dư hiện tại từ string sang number
    const currentTenantBalance = parseInt(
      escrowAccount.currentBalanceTenant,
      10,
    );
    const currentLandlordBalance = parseInt(
      escrowAccount.currentBalanceLandlord,
      10,
    );

    // Kiểm tra xem mỗi bên có đủ ký quỹ không
    const tenantHasEnough = currentTenantBalance >= requiredDeposit;
    const landlordHasEnough = currentLandlordBalance >= requiredDeposit;

    // Cập nhật trạng thái dựa trên kết quả kiểm tra
    if (tenantHasEnough && landlordHasEnough) {
      // Cả hai bên đều đủ ký quỹ => ACTIVE ngay lập tức
      extension.status = ExtensionStatus.ACTIVE;
      extension.activatedAt = vnNow();
      await this.applyExtension(extension);
    } else if (tenantHasEnough && !landlordHasEnough) {
      // Chỉ tenant đủ ký quỹ
      extension.status = ExtensionStatus.ESCROW_FUNDED_T;
      extension.tenantEscrowDepositFundedAt = vnNow();
    } else if (!tenantHasEnough && landlordHasEnough) {
      // Chỉ landlord đủ ký quỹ
      extension.status = ExtensionStatus.ESCROW_FUNDED_L;
      extension.landlordEscrowDepositFundedAt = vnNow();
    } else {
      // Cả hai bên đều thiếu ký quỹ
      extension.status = ExtensionStatus.AWAITING_ESCROW;
      extension.escrowDepositDueAt = addHours(vnNow(), 24);
    }
  }
}
