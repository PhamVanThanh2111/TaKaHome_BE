import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatVN, vnNow } from '../../common/datetime';

import { BlockchainEventHandlerService } from '../blockchain/blockchain-event-handler.service';
import { Booking } from '../booking/entities/booking.entity';
import { Contract } from '../contract/entities/contract.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';

export interface PenaltyApplication {
  contractId: string;
  bookingId: string;
  tenantId: string;
  daysPastDue: number;
  originalAmount: number;
  penaltyAmount: number;
  reason: string;
  appliedAt: Date;
}

/**
 * Automated Penalty Service
 * Handles automatic penalty application for late payments and contract violations
 */
@Injectable()
export class AutomatedPenaltyService {
  private readonly logger = new Logger(AutomatedPenaltyService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    
    private blockchainEventHandler: BlockchainEventHandlerService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Apply penalty for overdue payment
   */
  async applyPaymentOverduePenalty(
    booking: Booking,
    daysPastDue: number
  ): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.firstRentDueAt) {
        this.logger.warn(`Cannot apply penalty: missing contract or due date for booking ${booking.id}`);
        return null;
      }

      // Calculate penalty based on business rules
      const penaltyInfo = this.calculateOverduePenalty(daysPastDue);
      
      this.logger.log(`Applying ${penaltyInfo.rate}% penalty for booking ${booking.id} (${daysPastDue} days overdue)`);

      // Create penalty record on blockchain
      await this.blockchainEventHandler.handlePenaltyApplied({
        eventName: 'PenaltyApplied',
        blockNumber: 0, // Will be filled by actual blockchain call
        transactionId: `penalty_${booking.id}_${Date.now()}`,
        timestamp: formatVN(vnNow(), 'yyyy-MM-dd HH:mm:ss'),
        contractId: booking.contractId,
        party: 'tenant',
        amount: penaltyInfo.amount,
        reason: `Payment overdue by ${daysPastDue} days`,
        policyRef: 'AUTO_PENALTY_OVERDUE_PAYMENT',
        appliedBy: 'system',
        appliedAt: formatVN(vnNow(), 'yyyy-MM-dd HH:mm:ss'),
      });

      // Send notifications
      await this.sendPenaltyNotifications(booking, penaltyInfo, daysPastDue);

      const penaltyApplication: PenaltyApplication = {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        daysPastDue,
        originalAmount: 0, // Would need property rental amount
        penaltyAmount: penaltyInfo.amount,
        reason: penaltyInfo.reason,
        appliedAt: vnNow(),
      };

      this.logger.log(`✅ Successfully applied penalty for booking ${booking.id}`);
      return penaltyApplication;

    } catch (error) {
      this.logger.error(`❌ Failed to apply penalty for booking ${booking.id}:`, error);
      return null;
    }
  }

  /**
   * Apply penalty for deposit not paid on time
   */
  async applyDepositLatePenalty(booking: Booking): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.escrowDepositDueAt) {
        return null;
      }

      const hoursLate = Math.floor(
        (vnNow().getTime() - booking.escrowDepositDueAt.getTime()) / (1000 * 60 * 60)
      );

      if (hoursLate <= 0) return null; // Not late yet

      const penaltyInfo = this.calculateDepositLatePenalty(hoursLate);

      await this.blockchainEventHandler.handlePenaltyApplied({
        eventName: 'PenaltyApplied',
        blockNumber: 0,
        transactionId: `deposit_penalty_${booking.id}_${Date.now()}`,
        timestamp: formatVN(vnNow(), 'yyyy-MM-dd HH:mm:ss'),
        contractId: booking.contractId,
        party: 'tenant',
        amount: penaltyInfo.amount,
        reason: `Deposit payment late by ${hoursLate} hours`,
        policyRef: 'AUTO_PENALTY_LATE_DEPOSIT',
        appliedBy: 'system',
        appliedAt: formatVN(vnNow(), 'yyyy-MM-dd HH:mm:ss'),
      });

      return {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        daysPastDue: Math.floor(hoursLate / 24),
        originalAmount: 0,
        penaltyAmount: penaltyInfo.amount,
        reason: penaltyInfo.reason,
        appliedAt: vnNow(),
      };

    } catch (error) {
      this.logger.error(`❌ Failed to apply deposit penalty for booking ${booking.id}:`, error);
      return null;
    }
  }

  /**
   * Calculate penalty for overdue payment based on business rules
   */
  private calculateOverduePenalty(daysPastDue: number): {
    rate: number;
    amount: number;
    reason: string;
  } {
    let rate = 0;
    
    // Progressive penalty structure
    if (daysPastDue <= 7) {
      rate = 1; // 1% per day for first week
    } else if (daysPastDue <= 14) {
      rate = 2; // 2% per day for second week  
    } else if (daysPastDue <= 30) {
      rate = 3; // 3% per day for up to 1 month
    } else {
      rate = 5; // 5% per day after 1 month
    }

    // Base calculation - in practice, you'd get actual rental amount
    const baseAmount = 10000000; // 10M VND as example
    const penaltyAmount = Math.floor((baseAmount * rate * daysPastDue) / 100);

    return {
      rate,
      amount: penaltyAmount,
      reason: `Late payment penalty: ${rate}% per day for ${daysPastDue} days`,
    };
  }

  /**
   * Calculate penalty for late deposit
   */
  private calculateDepositLatePenalty(hoursLate: number): {
    rate: number;
    amount: number;
    reason: string;
  } {
    // Fixed penalty for late deposit
    const fixedPenalty = 500000; // 500K VND
    const hourlyPenalty = 50000; // 50K VND per hour after first 24h

    let totalPenalty = fixedPenalty;
    if (hoursLate > 24) {
      totalPenalty += (hoursLate - 24) * hourlyPenalty;
    }

    return {
      rate: 0,
      amount: totalPenalty,
      reason: `Late deposit penalty: ${hoursLate} hours late`,
    };
  }

  /**
   * Send penalty notifications to affected parties
   */
  private async sendPenaltyNotifications(
    booking: Booking,
    penaltyInfo: { amount: number; reason: string },
    daysPastDue: number
  ): Promise<void> {
    // Notify tenant
    await this.notificationService.create({
      userId: booking.tenant.id,
      type: NotificationTypeEnum.PAYMENT,
      title: '⚠️ Phí phạt đã được áp dụng',
      content: `Do thanh toán muộn ${daysPastDue} ngày cho căn hộ ${booking.property.title}, bạn đã bị áp dụng phí phạt ${penaltyInfo.amount.toLocaleString('vi-VN')} VND. Vui lòng thanh toán sớm để tránh thêm phí phạt.`,
    });

    // Notify landlord (if property has landlord relation)
    if (booking.property?.landlord?.id) {
      await this.notificationService.create({
        userId: booking.property.landlord.id,
        type: NotificationTypeEnum.PAYMENT,
        title: '💰 Phí phạt đã được áp dụng',
        content: `Phí phạt ${penaltyInfo.amount.toLocaleString('vi-VN')} VND đã được tự động áp dụng cho người thuê ${booking.tenant.fullName} do thanh toán muộn ${daysPastDue} ngày.`,
      });
    }

    this.logger.log(`📨 Sent penalty notifications for booking ${booking.id}`);
  }

  /**
   * Get penalty history for a contract or booking
   */
  async getPenaltyHistory(contractId?: string, bookingId?: string): Promise<any[]> {
    // This would typically query a penalty history table or blockchain
    // For now, return empty array as placeholder
    this.logger.log(`Getting penalty history for contract: ${contractId}, booking: ${bookingId}`);
    return [];
  }

  /**
   * Calculate total penalties applied to a tenant
   */
  async getTotalPenaltiesForTenant(tenantId: string, fromDate?: Date): Promise<{
    totalAmount: number;
    penaltyCount: number;
    lastPenaltyDate: Date | null;
  }> {
    // Placeholder implementation
    this.logger.log(`Getting total penalties for tenant: ${tenantId}`);
    
    return {
      totalAmount: 0,
      penaltyCount: 0,
      lastPenaltyDate: null,
    };
  }
}