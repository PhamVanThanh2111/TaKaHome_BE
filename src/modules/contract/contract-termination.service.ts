import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { vnNow, formatVN } from '../../common/datetime';

import { Contract } from '../contract/entities/contract.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Property } from '../property/entities/property.entity';
import { Room } from '../property/entities/room.entity';
import { EscrowService } from '../escrow/escrow.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { NotificationService } from '../notification/notification.service';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';

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
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,

    private escrowService: EscrowService,
    private blockchainService: BlockchainService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Terminate contract with proper refund calculation
   */
  async terminateContract(
    contractId: string,
    reason: string,
    terminatedBy: string,
  ): Promise<TerminationResult> {
    try {
      this.logger.log(
        `🛑 Starting contract termination process for ${contractId}`,
      );

      // Get contract with full relations
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
        relations: ['tenant', 'landlord', 'property', 'room'],
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Validate contract can be terminated
      if (
        contract.status === ContractStatusEnum.TERMINATED ||
        contract.status === ContractStatusEnum.CANCELLED
      ) {
        throw new Error(
          `Contract ${contractId} is already terminated/cancelled`,
        );
      }

      // Calculate refunds and distributions
      const calculation = await this.calculateTerminationRefunds(contractId);

      // Execute termination process
      await this.executeTermination(
        contract,
        calculation,
        reason,
        terminatedBy,
      );

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
      this.logger.error(
        `❌ Failed to terminate contract ${contractId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate refunds based on escrow balance - simply return all deposits to respective parties
   */
  private async calculateTerminationRefunds(
    contractId: string,
  ): Promise<TerminationCalculation> {
    try {
      // Get escrow balance
      const escrowResponse =
        await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        throw new Error(`No escrow account found for contract ${contractId}`);
      }

      const tenantBalance = parseInt(escrow.currentBalanceTenant || '0');
      const landlordBalance = parseInt(escrow.currentBalanceLandlord || '0');

      // Get contract details for remaining rent calculation
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
      const remainingMonths = Math.max(
        0,
        Math.ceil(
          (contract.endDate.getTime() - now.getTime()) /
            (30.44 * 24 * 60 * 60 * 1000),
        ),
      );

      // Simple refund logic: Return deposits to their respective parties
      const refundToTenant = tenantBalance;
      const refundToLandlord = landlordBalance;
      const penaltyAmount = 0; // No penalties, just return deposits

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
    terminatedBy: string,
  ): Promise<void> {
    try {
      // 1. Update contract status
      contract.status = ContractStatusEnum.TERMINATED;
      await this.contractRepository.save(contract);

      // 2. Update associated bookings
      await this.bookingRepository.update(
        { contractId: contract.id },
        {
          status: BookingStatus.CANCELLED,
          closedAt: vnNow(),
        },
      );

      // 3. Process refunds
      await this.processRefunds(contract, calculation);

      // 5. Hide property/room visibility
      await this.hidePropertyOrRoom(contract);

      // 6. Update blockchain
      await this.updateBlockchain(
        contract.contractCode || contract.id,
        reason,
        terminatedBy,
      );

      // 7. Send notifications
      await this.sendTerminationNotifications(contract, calculation, reason);

      this.logger.log(
        `✅ Termination execution completed for contract ${contract.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to execute termination for contract ${contract.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process refunds using EscrowService to return deposits to tenant and landlord wallets
   */
  private async processRefunds(
    contract: Contract,
    calculation: TerminationCalculation,
  ): Promise<void> {
    try {
      // Get escrow account for the contract
      const escrowResponse = await this.escrowService.ensureAccountForContract(
        contract.id,
      );
      const escrow = escrowResponse.data;

      if (!escrow) {
        this.logger.warn(`No escrow account found for contract ${contract.id}`);
        return;
      }

      // Refund tenant deposit using EscrowService
      if (calculation.refundToTenant > 0) {
        await this.escrowService.refund(
          escrow.id,
          calculation.refundToTenant,
          'TENANT',
          `Contract termination refund - ${contract.contractCode}`,
        );

        this.logger.log(
          `💰 Refunded ${calculation.refundToTenant} VND to tenant ${contract.tenant.id} via escrow`,
        );
      }

      // Refund landlord deposit using EscrowService
      if (calculation.refundToLandlord > 0) {
        await this.escrowService.refund(
          escrow.id,
          calculation.refundToLandlord,
          'LANDLORD',
          `Contract termination settlement - ${contract.contractCode}`,
        );

        this.logger.log(
          `💰 Settled ${calculation.refundToLandlord} VND to landlord ${contract.landlord.id} via escrow`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process refunds for contract ${contract.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Hide property or room visibility based on property type
   */
  private async hidePropertyOrRoom(contract: Contract): Promise<void> {
    try {
      if (!contract.property) {
        this.logger.warn(`No property found for contract ${contract.id}`);
        return;
      }

      // If property type is APARTMENT, hide the property
      if (contract.property.type === PropertyTypeEnum.APARTMENT) {
        await this.propertyRepository.update(
          { id: contract.property.id },
          { isVisible: false },
        );

        this.logger.log(
          `🏠 Hidden apartment property ${contract.property.id} (${contract.property.title})`,
        );
      }
      // If property type is BOARDING, hide the room
      else if (
        contract.property.type === PropertyTypeEnum.BOARDING &&
        contract.room
      ) {
        await this.roomRepository.update(
          { id: contract.room.id },
          { isVisible: false },
        );

        this.logger.log(
          `🏠 Hidden boarding room ${contract.room.id} (${contract.room.name}) in property ${contract.property.title}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to hide property/room for contract ${contract.id}:`,
        error,
      );
      // Don't throw error - continue with termination even if hiding fails
    }
  }

  /**
   * Update blockchain with termination
   */
  private async updateBlockchain(
    contractCode: string,
    reason: string,
    terminatedBy: string,
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
        fabricUser,
      );

      this.logger.log(
        `🔗 Contract ${contractCode} termination recorded on blockchain`,
      );
      return result.success ? 'blockchain-updated' : undefined;
    } catch (error) {
      this.logger.error(
        `❌ Failed to update blockchain for termination:`,
        error,
      );
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
    reason: string,
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

      this.logger.log(
        `📨 Termination notifications sent for contract ${contract.id}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to send termination notifications:`, error);
    }
  }
}
