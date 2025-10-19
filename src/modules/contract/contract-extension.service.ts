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
import { addMonths } from 'date-fns';

@Injectable()
export class ContractExtensionService {
  constructor(
    @InjectRepository(ContractExtension)
    private extensionRepository: Repository<ContractExtension>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
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

    // Cập nhật giá mới từ landlord
    if (dto.status === ExtensionStatus.LANDLORD_RESPONDED) {
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

    // Nếu tenant đồng ý, áp dụng extension
    if (dto.status === ExtensionStatus.APPROVED) {
      await this.applyExtension(extension);
    }

    const saved = await this.extensionRepository.save(extension);

    return new ResponseCommon(
      200,
      dto.status === ExtensionStatus.APPROVED
        ? 'Extension approved and applied successfully'
        : 'Extension rejected successfully',
      saved,
    );
  }
}
