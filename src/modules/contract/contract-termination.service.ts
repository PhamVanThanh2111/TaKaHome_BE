import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { vnNow, formatVN } from '../../common/datetime';

import { Contract } from '../contract/entities/contract.entity';
import { Booking } from '../booking/entities/booking.entity';
import { EscrowService } from '../escrow/escrow.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { NotificationService } from '../notification/notification.service';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';
import { WalletService } from '../wallet/wallet.service';
import { WalletTxnType } from '../common/enums/wallet-txn-type.enum';

export interface TerminationCalculation {
  refundToTenant: number;
  refundToLandlord: number;
  penaltyAmount: number;
  remainingRent: number;
  escrowBalance: {
    tenant: number;
    landlord: number;
  };
}

export interface TerminationResult {
  contractId: string;
  terminationDate: Date;
  reason: string;
  terminatedBy: string;
  calculation: TerminationCalculation;
  blockchainTxHash?: string;
}

/**
 * Contract Termination Service
 * Handles contract termination with proper refund calculation and escrow distribution
 */
@Injectable()
export class ContractTerminationService {
  private readonly logger = new Logger(ContractTerminationService.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    
    private escrowService: EscrowService,
    private blockchainService: BlockchainService,
    private notificationService: NotificationService,
    private walletService: WalletService,
  ) {}

  /**
   * Terminate contract with proper refund calculation
   */
  async terminateContract(
    contractId: string,
    reason: string,
    terminatedBy: string
  ): Promise<TerminationResult> {
    try {
      this.logger.log(`🛑 Starting contract termination process for ${contractId}`);

      // Get contract with full relations
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
        relations: ['tenant', 'landlord', 'property'],
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Validate contract can be terminated
      if (contract.status === ContractStatusEnum.TERMINATED || 
          contract.status === ContractStatusEnum.CANCELLED) {
        throw new Error(`Contract ${contractId} is already terminated/cancelled`);
      }

      // Calculate refunds and distributions
      const calculation = await this.calculateTerminationRefunds(contractId, reason);

      // Execute termination process
      await this.executeTermination(contract, calculation, reason, terminatedBy);

      const result: TerminationResult = {
        contractId,
        terminationDate: vnNow(),
        reason,
        terminatedBy,
        calculation,
      };

      this.logger.log(`✅ Contract ${contractId} terminated successfully`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Failed to terminate contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate refunds based on termination timing and reason
   */
  private async calculateTerminationRefunds(
    contractId: string,
    reason: string
  ): Promise<TerminationCalculation> {
    try {
      // Get escrow balance
      const escrowResponse = await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        throw new Error(`No escrow account found for contract ${contractId}`);
      }

      const tenantBalance = parseInt(escrow.currentBalanceTenant || '0');
      const landlordBalance = parseInt(escrow.currentBalanceLandlord || '0');

      // Get contract details
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
        relations: ['property'],
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      const monthlyRent = contract.property?.price || 0;
      const now = vnNow();
      
      // Calculate remaining contract duration (in months)
      const remainingMonths = Math.max(0, Math.ceil(
        (contract.endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      ));

      let refundToTenant = 0;
      let refundToLandlord = 0;
      let penaltyAmount = 0;

      // Termination logic based on reason
      if (reason.includes('breach') || reason.includes('violation') || reason.includes('penalty')) {
        // Tenant breach: Landlord keeps deposit, tenant gets remaining rent refund (if any)
        penaltyAmount = Math.min(tenantBalance, monthlyRent * 0.5); // Max 50% of monthly rent as penalty
        refundToTenant = Math.max(0, tenantBalance - penaltyAmount);
        refundToLandlord = landlordBalance + penaltyAmount;
        
      } else if (reason.includes('early exit') || reason.includes('tenant request')) {
        // Early termination by tenant: Standard penalty (1 month rent or remaining deposit)
        penaltyAmount = Math.min(tenantBalance, monthlyRent);
        refundToTenant = Math.max(0, tenantBalance - penaltyAmount);
        refundToLandlord = landlordBalance + penaltyAmount;
        
      } else if (reason.includes('landlord') || reason.includes('property issue')) {
        // Landlord fault: Full refund to tenant + compensation
        refundToTenant = tenantBalance + (monthlyRent * 0.1); // 10% compensation
        refundToLandlord = Math.max(0, landlordBalance - (monthlyRent * 0.1));
        
      } else {
        // Mutual agreement: Fair split
        refundToTenant = tenantBalance * 0.8; // 80% back to tenant
        refundToLandlord = landlordBalance + (tenantBalance * 0.2); // 20% to landlord as admin fee
      }

      return {
        refundToTenant: Math.max(0, refundToTenant),
        refundToLandlord: Math.max(0, refundToLandlord),
        penaltyAmount,
        remainingRent: remainingMonths * monthlyRent,
        escrowBalance: {
          tenant: tenantBalance,
          landlord: landlordBalance,
        },
      };

    } catch (error) {
      this.logger.error(`❌ Failed to calculate termination refunds:`, error);
      throw error;
    }
  }

  /**
   * Execute the termination process
   */
  private async executeTermination(
    contract: Contract,
    calculation: TerminationCalculation,
    reason: string,
    terminatedBy: string
  ): Promise<void> {
    try {
      // 1. Update contract status
      contract.status = ContractStatusEnum.TERMINATED;
      await this.contractRepository.save(contract);

      // 2. Update associated bookings
      await this.bookingRepository.update(
        { contractId: contract.id },
        { 
          status: BookingStatus.SETTLED,
          closedAt: vnNow()
        }
      );

      // 3. Process refunds
      await this.processRefunds(contract, calculation);

      // 4. Update blockchain
      await this.updateBlockchain(contract.contractCode || contract.id, reason, terminatedBy);

      // 5. Send notifications
      await this.sendTerminationNotifications(contract, calculation, reason);

      this.logger.log(`✅ Termination execution completed for contract ${contract.id}`);

    } catch (error) {
      this.logger.error(`❌ Failed to execute termination for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Process refunds to tenant and landlord wallets
   */
  private async processRefunds(
    contract: Contract,
    calculation: TerminationCalculation
  ): Promise<void> {
    try {
      // Refund to tenant
      if (calculation.refundToTenant > 0) {
        await this.walletService.credit(contract.tenant.id, {
          amount: calculation.refundToTenant,
          type: WalletTxnType.REFUND,
          refId: contract.id,
          note: `Contract termination refund - ${contract.contractCode}`,
        });
        
        this.logger.log(`💰 Refunded ${calculation.refundToTenant} VND to tenant ${contract.tenant.id}`);
      }

      // Refund to landlord
      if (calculation.refundToLandlord > 0) {
        await this.walletService.credit(contract.landlord.id, {
          amount: calculation.refundToLandlord,
          type: WalletTxnType.REFUND,
          refId: contract.id,
          note: `Contract termination settlement - ${contract.contractCode}`,
        });
        
        this.logger.log(`💰 Settled ${calculation.refundToLandlord} VND to landlord ${contract.landlord.id}`);
      }

    } catch (error) {
      this.logger.error(`❌ Failed to process refunds for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Update blockchain with termination
   */
  private async updateBlockchain(
    contractCode: string,
    reason: string,
    terminatedBy: string
  ): Promise<string | undefined> {
    try {
      const fabricUser = {
        userId: terminatedBy,
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      const result = await this.blockchainService.terminateContract(
        contractCode,
        reason,
        fabricUser
      );

      this.logger.log(`🔗 Contract ${contractCode} termination recorded on blockchain`);
      return result.success ? 'blockchain-updated' : undefined;

    } catch (error) {
      this.logger.error(`❌ Failed to update blockchain for termination:`, error);
      // Don't throw error - continue with termination even if blockchain fails
      return undefined;
    }
  }

  /**
   * Send termination notifications to all parties
   */
  private async sendTerminationNotifications(
    contract: Contract,
    calculation: TerminationCalculation,
    reason: string
  ): Promise<void> {
    try {
      const terminationDate = formatVN(vnNow(), 'dd/MM/yyyy HH:mm');

      // Notify tenant
      await this.notificationService.create({
        userId: contract.tenant.id,
        type: NotificationTypeEnum.CONTRACT,
        title: '🛑 Hợp đồng đã chấm dứt',
        content: `Hợp đồng thuê căn hộ ${contract.property.title} đã chấm dứt vào ${terminationDate}. Lý do: ${reason}. Số tiền hoàn trả: ${calculation.refundToTenant.toLocaleString('vi-VN')} VND.`,
      });

      // Notify landlord
      await this.notificationService.create({
        userId: contract.landlord.id,
        type: NotificationTypeEnum.CONTRACT,
        title: '🛑 Hợp đồng đã chấm dứt',
        content: `Hợp đồng với người thuê ${contract.tenant.fullName} cho căn hộ ${contract.property.title} đã chấm dứt vào ${terminationDate}. Lý do: ${reason}. Số tiền thanh toán: ${calculation.refundToLandlord.toLocaleString('vi-VN')} VND.`,
      });

      this.logger.log(`📨 Termination notifications sent for contract ${contract.id}`);

    } catch (error) {
      this.logger.error(`❌ Failed to send termination notifications:`, error);
      // Don't throw error - termination should still complete
    }
  }
}