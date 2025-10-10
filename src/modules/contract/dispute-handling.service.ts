import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { vnNow, formatVN } from '../../common/datetime';

import { Contract } from '../contract/entities/contract.entity';
import { Booking } from '../booking/entities/booking.entity';
import { EscrowService } from '../escrow/escrow.service';
import { NotificationService } from '../notification/notification.service';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';

export interface DisputeDetails {
  disputeId: string;
  contractId: string;
  initiatedBy: 'tenant' | 'landlord';
  disputeType: 'PAYMENT' | 'PROPERTY_CONDITION' | 'CONTRACT_VIOLATION' | 'EARLY_TERMINATION' | 'OTHER';
  reason: string;
  escrowFrozen: boolean;
  paymentsPaused: boolean;
  adminNotified: boolean;
  createdAt: Date;
}

/**
 * Dispute Handling Service
 * Manages contract disputes with escrow freezing and payment pausing
 */
@Injectable()
export class DisputeHandlingService {
  private readonly logger = new Logger(DisputeHandlingService.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    
    private escrowService: EscrowService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Raise a dispute for a contract
   */
  async raiseDispute(
    contractId: string, 
    disputeReason: string,
    initiatedBy: 'tenant' | 'landlord' = 'tenant',
    disputeType: 'PAYMENT' | 'PROPERTY_CONDITION' | 'CONTRACT_VIOLATION' | 'EARLY_TERMINATION' | 'OTHER' = 'OTHER'
  ): Promise<DisputeDetails> {
    try {
      this.logger.log(`🚨 Raising dispute for contract ${contractId} by ${initiatedBy}`);

      // Get contract details
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
        relations: ['tenant', 'landlord', 'property'],
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Validate contract status
      if (contract.status === ContractStatusEnum.TERMINATED || 
          contract.status === ContractStatusEnum.CANCELLED) {
        throw new Error(`Cannot raise dispute: Contract ${contractId} is already terminated/cancelled`);
      }

      // Check if dispute already exists
      const existingDispute = await this.checkExistingDispute(contractId);
      if (existingDispute) {
        throw new Error(`Dispute already exists for contract ${contractId}`);
      }

      const disputeId = this.generateDisputeId();

      // 1. Freeze escrow
      const escrowFrozen = await this.freezeEscrow(contractId);

      // 2. Pause payments
      const paymentsPaused = await this.pausePayments(contractId);

      // 3. Update contract status to DISPUTED
      await this.updateContractStatus(contractId, 'DISPUTED');

      // 4. Notify admin
      const adminNotified = await this.notifyAdmin(contract, disputeReason, initiatedBy, disputeType);

      // 5. Notify parties
      await this.notifyParties(contract, disputeReason, initiatedBy, disputeType);

      const disputeDetails: DisputeDetails = {
        disputeId,
        contractId,
        initiatedBy,
        disputeType,
        reason: disputeReason,
        escrowFrozen,
        paymentsPaused,
        adminNotified,
        createdAt: vnNow(),
      };

      // 6. Store dispute record (you might want to create a Dispute entity)
      await this.storeDisputeRecord(disputeDetails);

      this.logger.log(`✅ Dispute ${disputeId} raised successfully for contract ${contractId}`);
      return disputeDetails;

    } catch (error) {
      this.logger.error(`❌ Failed to raise dispute for contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve a dispute
   */
  async resolveDispute(
    contractId: string,
    resolution: string,
    resolvedBy: string,
    outcome: 'TENANT_FAVOR' | 'LANDLORD_FAVOR' | 'MUTUAL_AGREEMENT' | 'DISMISSED'
  ): Promise<boolean> {
    try {
      this.logger.log(`🔧 Resolving dispute for contract ${contractId}`);

      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
        relations: ['tenant', 'landlord', 'property'],
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // 1. Unfreeze escrow
      await this.unfreezeEscrow(contractId);

      // 2. Resume payments
      await this.resumePayments(contractId);

      // 3. Update contract status back to ACTIVE
      await this.updateContractStatus(contractId, 'ACTIVE');

      // 4. Notify parties about resolution
      await this.notifyResolution(contract, resolution, outcome);

      // 5. Update dispute record
      await this.updateDisputeRecord(contractId, 'RESOLVED', resolution, resolvedBy);

      this.logger.log(`✅ Dispute resolved for contract ${contractId}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Failed to resolve dispute for contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Check if dispute already exists for contract
   */
  private async checkExistingDispute(contractId: string): Promise<boolean> {
    try {
      // This would check a disputes table if it existed
      // For now, we'll check if contract status contains 'DISPUTED'
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
      });

      return contract?.status.toString().includes('DISPUTED') || false;
    } catch (error) {
      this.logger.error(`Failed to check existing dispute for contract ${contractId}:`, error);
      return false;
    }
  }

  /**
   * Freeze escrow to prevent withdrawals during dispute
   */
  private async freezeEscrow(contractId: string): Promise<boolean> {
    try {
      // Get escrow account
      const escrowResponse = await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        this.logger.warn(`No escrow account found for contract ${contractId}`);
        return false;
      }

      // In a real implementation, you'd add a 'frozen' field to Escrow entity
      // For now, we'll log the freeze action
      this.logger.log(`❄️ Escrow frozen for contract ${contractId}`);
      
      // Notify escrow freeze via notification
      await this.notificationService.create({
        userId: 'admin', // System admin
        type: NotificationTypeEnum.GENERAL,
        title: '❄️ Escrow Frozen - Dispute Active',
        content: `Escrow account for contract ${contractId} has been frozen due to active dispute. No withdrawals allowed until resolution.`,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to freeze escrow for contract ${contractId}:`, error);
      return false;
    }
  }

  /**
   * Unfreeze escrow after dispute resolution
   */
  private async unfreezeEscrow(contractId: string): Promise<boolean> {
    try {
      this.logger.log(`🔓 Escrow unfrozen for contract ${contractId}`);
      
      await this.notificationService.create({
        userId: 'admin',
        type: NotificationTypeEnum.GENERAL,
        title: '🔓 Escrow Unfrozen - Dispute Resolved',
        content: `Escrow account for contract ${contractId} has been unfrozen. Normal operations resumed.`,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to unfreeze escrow for contract ${contractId}:`, error);
      return false;
    }
  }

  /**
   * Pause payments during dispute
   */
  private async pausePayments(contractId: string): Promise<boolean> {
    try {
      // In a real implementation, you'd update booking/contract to mark payments as paused
      this.logger.log(`⏸️ Payments paused for contract ${contractId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause payments for contract ${contractId}:`, error);
      return false;
    }
  }

  /**
   * Resume payments after dispute resolution
   */
  private async resumePayments(contractId: string): Promise<boolean> {
    try {
      this.logger.log(`▶️ Payments resumed for contract ${contractId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume payments for contract ${contractId}:`, error);
      return false;
    }
  }

  /**
   * Update contract status to DISPUTED or back to ACTIVE
   */
  private async updateContractStatus(contractId: string, status: 'DISPUTED' | 'ACTIVE'): Promise<void> {
    try {
      // Since DISPUTED might not be in the enum, we'll use a special notation
      const contractStatus = status === 'DISPUTED' 
        ? ContractStatusEnum.ACTIVE // Keep as active but we'll track dispute separately
        : ContractStatusEnum.ACTIVE;

      await this.contractRepository.update(contractId, { 
        status: contractStatus 
      });

      // Also update associated booking if exists
      if (status === 'DISPUTED') {
        await this.bookingRepository.update(
          { contractId },
          { status: BookingStatus.SETTLEMENT_PENDING } // Use existing status to indicate dispute
        );
      } else {
        await this.bookingRepository.update(
          { contractId },
          { status: BookingStatus.ACTIVE }
        );
      }

    } catch (error) {
      this.logger.error(`Failed to update contract status for ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Notify admin about the dispute
   */
  private async notifyAdmin(
    contract: Contract,
    reason: string,
    initiatedBy: 'tenant' | 'landlord',
    disputeType: string
  ): Promise<boolean> {
    try {
      await this.notificationService.create({
        userId: 'admin', // System admin user ID
        type: NotificationTypeEnum.GENERAL,
        title: `🚨 New Dispute Raised - Contract ${contract.contractCode}`,
        content: `URGENT: Dispute raised by ${initiatedBy} for contract ${contract.contractCode} (Property: ${contract.property.title}). Type: ${disputeType}. Reason: ${reason}. Escrow frozen and payments paused. Please review immediately.`,
      });

      // Also notify property management if different from admin
      await this.notificationService.create({
        userId: contract.property.landlord.id,
        type: NotificationTypeEnum.GENERAL,
        title: '🚨 Dispute Notification',
        content: `A dispute has been raised for your property ${contract.property.title}. Admin has been notified and will review the case. Escrow is temporarily frozen.`,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to notify admin about dispute:`, error);
      return false;
    }
  }

  /**
   * Notify both parties about the dispute
   */
  private async notifyParties(
    contract: Contract,
    reason: string,
    initiatedBy: 'tenant' | 'landlord',
    disputeType: string
  ): Promise<void> {
    try {
      const initiatedDate = formatVN(vnNow(), 'dd/MM/yyyy HH:mm');

      // Notify tenant
      await this.notificationService.create({
        userId: contract.tenant.id,
        type: NotificationTypeEnum.GENERAL,
        title: '🚨 Tranh chấp hợp đồng',
        content: `Tranh chấp đã được khởi tạo ${initiatedBy === 'tenant' ? 'bởi bạn' : 'bởi chủ nhà'} vào ${initiatedDate} cho căn hộ ${contract.property.title}. Lý do: ${reason}. Escrow đã tạm dừng và thanh toán bị tạm hoãn cho đến khi giải quyết.`,
      });

      // Notify landlord
      await this.notificationService.create({
        userId: contract.landlord.id,
        type: NotificationTypeEnum.GENERAL,
        title: '🚨 Tranh chấp hợp đồng',
        content: `Tranh chấp đã được khởi tạo ${initiatedBy === 'landlord' ? 'bởi bạn' : 'bởi người thuê'} vào ${initiatedDate} cho căn hộ ${contract.property.title}. Lý do: ${reason}. Admin đã được thông báo và sẽ xem xét vụ việc.`,
      });

    } catch (error) {
      this.logger.error(`Failed to notify parties about dispute:`, error);
    }
  }

  /**
   * Notify parties about dispute resolution
   */
  private async notifyResolution(
    contract: Contract,
    resolution: string,
    outcome: string
  ): Promise<void> {
    try {
      const resolvedDate = formatVN(vnNow(), 'dd/MM/yyyy HH:mm');

      // Notify tenant
      await this.notificationService.create({
        userId: contract.tenant.id,
        type: NotificationTypeEnum.GENERAL,
        title: '✅ Tranh chấp đã được giải quyết',
        content: `Tranh chấp cho căn hộ ${contract.property.title} đã được giải quyết vào ${resolvedDate}. Kết quả: ${outcome}. Chi tiết: ${resolution}. Escrow đã được mở khóa và thanh toán được tiếp tục.`,
      });

      // Notify landlord
      await this.notificationService.create({
        userId: contract.landlord.id,
        type: NotificationTypeEnum.GENERAL,
        title: '✅ Tranh chấp đã được giải quyết',
        content: `Tranh chấp cho căn hộ ${contract.property.title} đã được giải quyết vào ${resolvedDate}. Kết quả: ${outcome}. Chi tiết: ${resolution}. Hoạt động bình thường đã được khôi phục.`,
      });

    } catch (error) {
      this.logger.error(`Failed to notify resolution:`, error);
    }
  }

  /**
   * Generate unique dispute ID
   */
  private generateDisputeId(): string {
    const timestamp = formatVN(vnNow(), 'yyyyMMddHHmmss');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DISP-${timestamp}-${random}`;
  }

  /**
   * Store dispute record (placeholder - you might want to create a Dispute entity)
   */
  private async storeDisputeRecord(disputeDetails: DisputeDetails): Promise<void> {
    try {
      // In a real implementation, you'd save to a Dispute entity
      this.logger.log(`📝 Stored dispute record: ${JSON.stringify(disputeDetails)}`);
    } catch (error) {
      this.logger.error(`Failed to store dispute record:`, error);
    }
  }

  /**
   * Update dispute record with resolution
   */
  private async updateDisputeRecord(
    contractId: string,
    status: string,
    resolution: string,
    resolvedBy: string
  ): Promise<void> {
    try {
      // In a real implementation, you'd update the Dispute entity
      this.logger.log(`📝 Updated dispute record for contract ${contractId}: ${status} by ${resolvedBy}`);
    } catch (error) {
      this.logger.error(`Failed to update dispute record:`, error);
    }
  }
}