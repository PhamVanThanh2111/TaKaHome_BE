import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { vnNow } from '../../common/datetime';
import { addMonths, addHours } from 'date-fns';
import { SmartCAService } from '../smartca/smartca.service';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { User } from '../user/entities/user.entity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ContractExtensionService {
  constructor(
    @InjectRepository(ContractExtension)
    private extensionRepository: Repository<ContractExtension>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private smartcaService: SmartCAService,
    private s3StorageService: S3StorageService,
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
      throw new NotFoundException('Contract not found');
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
      throw new NotFoundException('Extension request not found');
    }

    // Chỉ landlord mới có thể phản hồi
    if (extension.contract.landlord.id !== userId) {
      throw new ForbiddenException(
        'Only landlord can respond to extension request',
      );
    }

    // Extension phải đang pending
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException('Extension request is not pending');
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
      if (dto.newElectricityPrice !== undefined) {
        extension.newElectricityPrice = dto.newElectricityPrice;
      }
      if (dto.newWaterPrice !== undefined) {
        extension.newWaterPrice = dto.newWaterPrice;
      }
    }

    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      'Extension request responded successfully',
      saved,
    );
  }

  private async applyExtension(extension: ContractExtension): Promise<void> {
    const contract = extension.contract;

    // Gia hạn contract
    const newEndDate = addMonths(contract.endDate, extension.extensionMonths);
    contract.endDate = newEndDate;

    // Chỉ gia hạn contract, giá sẽ được lưu trong ContractExtension
    // Không thay đổi giá trong Property/RoomType để tránh ảnh hưởng đến các contract khác
    await this.contractRepository.save(contract);
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
      throw new NotFoundException('Contract not found');
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

  async cancelExtension(
    extensionId: string,
    userId: string,
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant'],
    });

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }

    // Chỉ tenant (người tạo extension) mới có thể cancel
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException('Only the tenant can cancel the extension');
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
      throw new NotFoundException('Extension request not found');
    }

    // Chỉ đúng tenant mới có thể đồng ý/từ chối
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException('Only tenant can respond to this extension');
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
    } else {
      extension.status = ExtensionStatus.REJECTED;
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
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant', 'contract.landlord'],
    });

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }

    // Chỉ landlord mới có thể ký
    if (extension.contract.landlord.id !== userId) {
      throw new ForbiddenException('Only landlord can sign extension contract');
    }

    // Extension phải ở trạng thái AWAITING_SIGNATURES
    if (extension.status !== ExtensionStatus.AWAITING_SIGNATURES) {
      throw new BadRequestException(
        'Extension is not ready for landlord signing',
      );
    }

    try {
      // Read PDF file từ assets
      const pdfPath = path.join(
        process.cwd(),
        'src',
        'assets',
        'contracts',
        'HopDongChoThueNhaNguyenCan.pdf',
      );

      if (!fs.existsSync(pdfPath)) {
        throw new BadRequestException(`PDF file not found at: ${pdfPath}`);
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      const landlord = await this.userRepository.findOne({
        where: { id: userId },
      });

      // Landlord ký hợp đồng gia hạn (signatureIndex: 0)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer,
        signatureIndex: 0,
        userIdOverride: landlord?.CCCD,
        contractId: extension.contract.id,
        intervalMs: 2000,
        timeoutMs: 120000,
        reason: 'Contract Extension Landlord Signature',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Landlord Extension Signature',
        creator: 'SmartCA VNPT 2025',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Landlord extension signing failed: ${signResult.error}`,
        );
      }

      // Upload signed PDF to S3
      if (signResult.signedPdf) {
        const uploadResult = await this.s3StorageService.uploadContractPdf(
          signResult.signedPdf,
          {
            contractId: extension.contract.id,
            role: 'LANDLORD',
            signatureIndex: 0,
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

        extension.extensionContractFileUrl = uploadResult.url;
      }

      // Cập nhật extension
      extension.status = ExtensionStatus.LANDLORD_SIGNED;
      extension.landlordSignedAt = vnNow();
      extension.transactionIdLandlordSign = signResult.transactionId;

      const saved = await this.extensionRepository.save(extension);

      return new ResponseCommon(
        200,
        'Landlord signed extension successfully',
        saved,
      );
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
  ): Promise<ResponseCommon<ContractExtension>> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
      relations: ['contract', 'contract.tenant', 'contract.landlord'],
    });

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }

    // Chỉ tenant mới có thể ký
    if (extension.contract.tenant.id !== userId) {
      throw new ForbiddenException('Only tenant can sign extension contract');
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
        userIdOverride: tenant?.CCCD,
        contractId: extension.contract.id,
        intervalMs: 2000,
        timeoutMs: 120000,
        reason: 'Contract Extension Tenant Signature',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Tenant Extension Signature',
        creator: 'SmartCA VNPT 2025',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Tenant extension signing failed: ${signResult.error}`,
        );
      }

      // Upload fully-signed PDF to S3
      if (signResult.signedPdf) {
        const uploadResult = await this.s3StorageService.uploadContractPdf(
          signResult.signedPdf,
          {
            contractId: extension.contract.id,
            role: 'TENANT',
            signatureIndex: 1,
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

        extension.extensionContractFileUrl = uploadResult.url;
      }

      // Cập nhật extension và set deadline cho ký quỹ (24 giờ)
      extension.status = ExtensionStatus.AWAITING_ESCROW;
      extension.tenantSignedAt = vnNow();
      extension.transactionIdTenantSign = signResult.transactionId;
      extension.escrowDepositDueAt = addHours(vnNow(), 24);

      const saved = await this.extensionRepository.save(extension);

      return new ResponseCommon(
        200,
        'Tenant signed extension successfully',
        saved,
      );
    } catch (error) {
      console.error('[TenantSignExtension] ❌ Failed:', error);
      throw new BadRequestException(
        `Failed to complete tenant extension signing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
