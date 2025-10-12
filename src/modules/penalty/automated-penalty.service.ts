import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatVN, vnNow } from '../../common/datetime';

import { BlockchainService } from '../blockchain/blockchain.service';
import { Booking } from '../booking/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Contract } from '../contract/entities/contract.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';
import { EscrowService } from '../escrow/escrow.service';
import { PenaltyRecord } from './entities/penalty-record.entity';

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
    @InjectRepository(PenaltyRecord)
    private penaltyRecordRepository: Repository<PenaltyRecord>,
    
    private blockchainService: BlockchainService,
    private notificationService: NotificationService,
    private escrowService: EscrowService,
  ) {}

  /**
   * Apply penalty for overdue payment with contract termination check
   */
  async applyPaymentOverduePenalty(
    booking: Booking,
    daysPastDue: number,
    rentAmount?: number
  ): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.firstRentDueAt) {
        this.logger.warn(`Cannot apply penalty: missing contract or due date for booking ${booking.id}`);
        return null;
      }

      // Get actual rent amount from property if available
      const actualRentAmount = rentAmount || booking.property?.price || 10000000;

      // Check if penalty already exists for this period to avoid double penalty
      const existingPenalty = await this.checkExistingPenalty(
        booking.contractId,
        'OVERDUE_PAYMENT',
        booking.firstRentDueAt
      );

      if (existingPenalty) {
        this.logger.warn(`Penalty already applied for booking ${booking.id} on ${formatVN(existingPenalty.appliedAt, 'yyyy-MM-dd')}`);
        return null;
      }

      // Calculate penalty based on Vietnam legal requirements
      const penaltyInfo = this.calculateOverduePenalty(daysPastDue, actualRentAmount);
      
      this.logger.log(`Applying ${penaltyInfo.rate}% penalty for booking ${booking.id} (${daysPastDue} days overdue)`);

      // Check escrow balance before applying penalty
      const escrowBalance = await this.checkEscrowBalance(booking.contractId);
      
      // If penalty would exceed escrow balance or contract should be terminated
      if (!penaltyInfo.canContinue || (escrowBalance && penaltyInfo.amount > escrowBalance.tenantBalance)) {
        this.logger.warn(`⚠️ Penalty exceeds limits for booking ${booking.id}. Initiating contract termination.`);
        
        // Initiate contract termination process
        await this.terminateContractForInsufficientFunds(
          booking.contractId, 
          booking.id,
          `Insufficient escrow funds to cover penalties. Total penalty: ${penaltyInfo.amount.toLocaleString('vi-VN')} VND`
        );
        
        return null;
      }

      // Record penalty on blockchain
      await this.recordPenaltyOnBlockchain(
        booking.contractId,
        'tenant',
        penaltyInfo.amount,
        `Payment overdue by ${daysPastDue} days`
      );

      // Deduct penalty from tenant's escrow balance
      await this.deductFromEscrow(
        booking.contractId,
        penaltyInfo.amount,
        `Payment overdue by ${daysPastDue} days`
      );

      // Send notifications
      await this.sendPenaltyNotifications(booking, penaltyInfo, daysPastDue);

      // Record penalty in database
      await this.recordPenaltyInDatabase({
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        penaltyType: 'OVERDUE_PAYMENT',
        overdueDate: booking.firstRentDueAt,
        daysPastDue,
        originalAmount: actualRentAmount,
        penaltyAmount: penaltyInfo.amount,
        penaltyRate: penaltyInfo.rate,
        reason: penaltyInfo.reason,
        appliedBy: 'system',
      });

      const penaltyApplication: PenaltyApplication = {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        daysPastDue,
        originalAmount: actualRentAmount,
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
   * Cancel booking and contract if deposit not paid within 24 hours
   */
  async cancelBookingForLateDeposit(booking: Booking): Promise<{ cancelled: boolean; reason: string } | null> {
    try {
      if (!booking.contractId || !booking.escrowDepositDueAt) {
        return null;
      }

      const hoursLate = Math.floor(
        (vnNow().getTime() - booking.escrowDepositDueAt.getTime()) / (1000 * 60 * 60)
      );

      // Cancel if more than 24 hours late
      if (hoursLate > 24) {
        // Cancel booking
        booking.status = BookingStatus.CANCELLED;
        booking.closedAt = vnNow(); // Use existing closedAt field to mark cancellation time
        
        // Save booking changes
        await this.bookingRepository.save(booking);
        
        // Send cancellation notifications
        await this.notificationService.create({
          userId: booking.tenant.id,
          type: NotificationTypeEnum.GENERAL,
          title: 'Booking Cancelled - Late Deposit',
          content: `Your booking has been cancelled due to deposit not paid within 24 hours (${hoursLate} hours late). The contract and booking are now invalid.`,
        });

        // Send notification to landlord
        if (booking.property?.landlord?.id) {
          await this.notificationService.create({
            userId: booking.property.landlord.id,
            type: NotificationTypeEnum.GENERAL,
            title: 'Booking Cancelled - Tenant Late Deposit',
            content: `Booking ${booking.id} has been automatically cancelled. Tenant did not pay deposit within 24 hours (${hoursLate} hours late).`,
          });
        }

        this.logger.log(`✅ Booking ${booking.id} cancelled due to deposit not paid within 24 hours (${hoursLate}h late)`);

        return {
          cancelled: true,
          reason: `Deposit not paid within 24 hours (${hoursLate}h late)`
        };
      }

      return null; // Not late enough to cancel yet

    } catch (error) {
      this.logger.error(`❌ Failed to cancel booking ${booking.id} for late deposit:`, error);
      return null;
    }
  }

  /**
   * Calculate penalty for overdue payment based on Vietnam legal requirements
   */
  private calculateOverduePenalty(daysPastDue: number, rentAmount?: number): {
    rate: number;
    amount: number;
    reason: string;
    canContinue: boolean;
  } {
    // Vietnam legal requirement: Maximum 0.03% per day
    const rate = 0.03; // 0.03% per day as per Vietnamese law
    
    // Use actual rent amount or fallback to default
    const baseAmount = rentAmount || 10000000; // 10M VND as fallback
    const penaltyAmount = Math.floor((baseAmount * rate * daysPastDue) / 100);
    
    // Maximum penalty cap: 20% of contract value (Vietnamese consumer protection)
    const maxPenalty = Math.floor(baseAmount * 0.2);
    const finalPenalty = Math.min(penaltyAmount, maxPenalty);

    // Contract termination logic: If penalties exceed 15% of rent, recommend termination
    const canContinue = finalPenalty < (baseAmount * 0.15);

    return {
      rate,
      amount: finalPenalty,
      reason: `Late payment penalty: ${rate}% per day for ${daysPastDue} days (Legal limit: VN Law)`,
      canContinue,
    };
  }

  /**
   * @deprecated Deposit penalties are no longer applied. 
   * Bookings are cancelled after 24h instead.
   * Use cancelBookingForLateDeposit() method instead.
   */

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
    try {
      const query = this.penaltyRecordRepository
        .createQueryBuilder('penalty')
        .where('penalty.tenantId = :tenantId', { tenantId })
        .andWhere('penalty.status = :status', { status: 'APPLIED' });

      if (fromDate) {
        query.andWhere('penalty.appliedAt >= :fromDate', { fromDate });
      }

      const penalties = await query.getMany();
      
      const totalAmount = penalties.reduce((sum, p) => sum + Number(p.penaltyAmount), 0);
      const lastPenalty = penalties.length > 0 ? penalties[0].appliedAt : null;

      return {
        totalAmount,
        penaltyCount: penalties.length,
        lastPenaltyDate: lastPenalty,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get total penalties for tenant ${tenantId}:`, error);
      return { totalAmount: 0, penaltyCount: 0, lastPenaltyDate: null };
    }
  }

  /**
   * Deduct penalty amount from escrow balance
   */
  private async deductFromEscrow(
    contractId: string,
    penaltyAmount: number,
    reason: string
  ): Promise<void> {
    try {
      // Get escrow account for the contract
      const escrowResponse = await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        this.logger.warn(`No escrow account found for contract ${contractId}`);
        return;
      }

      // Deduct penalty amount from tenant's escrow balance
      await this.escrowService.deduct(
        escrow.id,
        penaltyAmount,
        'TENANT',
        `Penalty deduction: ${reason}`
      );

      this.logger.log(`✅ Deducted ${penaltyAmount} VND from escrow for contract ${contractId}: ${reason}`);
    } catch (error) {
      this.logger.error(`❌ Failed to deduct penalty from escrow for contract ${contractId}:`, error);
      // Don't throw error to not break the penalty application process
    }
  }

  /**
   * Record penalty on blockchain
   */
  private async recordPenaltyOnBlockchain(
    contractId: string,
    party: string,
    amount: number,
    reason: string
  ): Promise<void> {
    try {
      // Create FabricUser for system operations (use landlord MSP)
      const fabricUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      await this.blockchainService.recordPenalty(
        contractId,
        party,
        amount.toString(),
        reason,
        fabricUser
      );

      this.logger.log(`✅ Penalty recorded on blockchain for contract ${contractId}: ${amount} VND`);
    } catch (error) {
      this.logger.error(`❌ Failed to record penalty on blockchain:`, error);
      throw error;
    }
  }

  /**
   * Check and apply automatic penalties for overdue payments
   */
  async processOverduePayments(): Promise<void> {
    try {
      this.logger.log('🔍 Processing overdue payments for penalty application...');

      // Find active bookings with overdue first rent payments
      const overdueBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.DUAL_ESCROW_FUNDED, // Should have paid first rent by now
        },
        relations: ['tenant', 'contract'],
      });

      let penaltiesApplied = 0;

      for (const booking of overdueBookings) {
        if (!booking.firstRentDueAt || !booking.firstRentPaidAt) {
          const now = vnNow();
          const dueDate = booking.firstRentDueAt || now;
          
          if (now > dueDate) {
            const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysPastDue > 0) {
              this.logger.log(`📅 Found overdue payment: booking ${booking.id}, ${daysPastDue} days past due`);
              
              const penalty = await this.applyPaymentOverduePenalty(booking, daysPastDue);
              if (penalty) {
                penaltiesApplied++;
              }
            }
          }
        }
      }

      this.logger.log(`✅ Processed overdue payments: ${penaltiesApplied} penalties applied`);
    } catch (error) {
      this.logger.error('❌ Failed to process overdue payments:', error);
    }
  }

  /**
   * Check and apply automatic penalties for overdue monthly payments from blockchain
   */
  async processMonthlyOverduePayments(): Promise<void> {
    try {
      this.logger.log('🔍 Processing monthly overdue payments from blockchain...');

      // Create system user for blockchain queries
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };
      // Query SCHEDULED payments from blockchain (not overdue yet)
      const scheduledResponse = await this.blockchainService.queryPaymentsByStatus('SCHEDULED', systemUser);
      if (!scheduledResponse.success || !scheduledResponse.data) {
        return;
      }

      const scheduledPayments = scheduledResponse.data;
      // Filter for overdue payments
      const now = vnNow();
      const overduePayments = scheduledPayments.filter(payment => {
        const dueDate = new Date(payment.dueDate!);
        return now > dueDate;
      });
      
      let penaltiesApplied = 0;
      for (const payment of overduePayments) {
        try {
          this.logger.log(`🔍 Processing payment: ${JSON.stringify({ contractId: payment.contractId, period: payment.period, status: payment.status, dueDate: payment.dueDate })}`);
          // Skip first payment (period 1) as it's handled by processOverduePayments
          if (payment.period <= 1) {
            continue;
          }

          // Find corresponding contract in database
          this.logger.log(`🔎 Looking for contract with contractCode: ${payment.contractId}`);
          const contract = await this.contractRepository.findOne({
            where: { contractCode: payment.contractId },
            relations: ['tenant', 'landlord', 'property'],
          });

          if (!contract) {
            continue;
          }
          // Calculate days overdue
          const dueDate = new Date(payment.dueDate!);
          const now = vnNow();
          const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysPastDue > 0) {
            // Step 1: Mark payment as overdue on blockchain
            await this.blockchainService.markOverdue(payment.contractId, payment.period.toString(), systemUser);
            
            // Step 2: Apply penalty and deduct from escrow
            const penalty = await this.applyMonthlyPaymentOverduePenalty(
              contract,
              payment.period.toString(),
              daysPastDue,
              payment.amount
            );
            
            if (penalty) {
              penaltiesApplied++;
            } 
          } 
        } catch (error) {
          this.logger.error(`❌ Failed to process overdue payment ${payment.contractId} period ${payment.period}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to process monthly overdue payments:', error);
      this.logger.error('Error details:', error);
    }
  }

  /**
   * Apply penalty for overdue monthly payment
   */
  async applyMonthlyPaymentOverduePenalty(
    contract: Contract,
    period: string,
    daysPastDue: number,
    originalAmount: number
  ): Promise<PenaltyApplication | null> {
    try {
      if (!contract.contractCode) {
        return null;
      }
      // Calculate penalty based on business rules
      const penaltyInfo = this.calculateOverduePenalty(daysPastDue);
      // Create system user for blockchain operations
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };
      await this.deductFromEscrow(
        contract.id,
        penaltyInfo.amount,
        `Monthly payment period ${period} overdue by ${daysPastDue} days`
      );
      // Apply penalty to specific payment period on blockchain
      await this.blockchainService.applyPenalty(
        contract.contractCode,
        period,
        penaltyInfo.amount.toString(),
        'MONTHLY_PAYMENT_OVERDUE',
        `Monthly payment period ${period} overdue by ${daysPastDue} days`,
        systemUser
      );
      // Send notifications
      this.logger.log(`📨 Sending penalty notifications for contract ${contract.contractCode} period ${period}`);
      await this.sendMonthlyPaymentPenaltyNotifications(
        contract,
        period,
        penaltyInfo.amount,
        daysPastDue
      );
      const penaltyApplication: PenaltyApplication = {
        contractId: contract.id,
        bookingId: '', // Monthly payments don't have booking reference
        tenantId: contract.tenant.id,
        daysPastDue,
        originalAmount,
        penaltyAmount: penaltyInfo.amount,
        reason: `Monthly payment period ${period} overdue by ${daysPastDue} days`,
        appliedAt: vnNow(),
      };
      return penaltyApplication;
    } catch (error) {
      this.logger.error(`❌ Failed to apply monthly payment penalty for contract ${contract.contractCode} period ${period}:`, error);
      return null;
    }
  }

  /**
   * Send penalty notifications for monthly payment overdue
   */
  private async sendMonthlyPaymentPenaltyNotifications(
    contract: Contract,
    period: string,
    penaltyAmount: number,
    daysPastDue: number
  ): Promise<void> {
    const periodDisplay = `tháng ${period}`;
    
    await this.notificationService.create({
      userId: contract.tenant.id,
      type: NotificationTypeEnum.PAYMENT,
      title: '⚠️ Phí phạt thanh toán hàng tháng',
      content: `Do thanh toán muộn ${daysPastDue} ngày cho ${periodDisplay} của căn hộ ${contract.property.title}, bạn đã bị áp dụng phí phạt ${penaltyAmount.toLocaleString('vi-VN')} VND. Vui lòng thanh toán sớm để tránh thêm phí phạt.`,
    });

    await this.notificationService.create({
      userId: contract.landlord.id,
      type: NotificationTypeEnum.PAYMENT,
      title: '💰 Phí phạt thanh toán hàng tháng',
      content: `Phí phạt ${penaltyAmount.toLocaleString('vi-VN')} VND đã được tự động áp dụng cho người thuê ${contract.tenant.fullName} do thanh toán muộn ${daysPastDue} ngày cho ${periodDisplay} của căn hộ ${contract.property.title}.`,
    });

    this.logger.log(`📨 Sent monthly payment penalty notifications for contract ${contract.contractCode} period ${period}`);
  }

  /**
   * Check escrow balance for a contract
   */
  private async checkEscrowBalance(contractId: string): Promise<{ tenantBalance: number; landlordBalance: number } | null> {
    try {
      const escrowResponse = await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        return null;
      }

      return {
        tenantBalance: parseInt(escrow.currentBalanceTenant || '0'),
        landlordBalance: parseInt(escrow.currentBalanceLandlord || '0'),
      };
    } catch (error) {
      this.logger.error(`❌ Failed to check escrow balance for contract ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Terminate contract when escrow funds are insufficient
   */
  private async terminateContractForInsufficientFunds(
    contractId: string,
    bookingId: string,
    reason: string
  ): Promise<void> {
    try {
      this.logger.log(`🛑 Terminating contract ${contractId} due to insufficient funds: ${reason}`);

      // Update booking status to CANCELLED
      await this.bookingRepository.update(bookingId, {
        status: BookingStatus.CANCELLED,
        closedAt: vnNow(),
      });

      // Record termination on blockchain
      const fabricUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      await this.blockchainService.terminateContract(
        contractId,
        reason,
        fabricUser
      );

      // Get booking details for notifications
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['tenant', 'property', 'property.landlord'],
      });

      if (booking) {
        // Notify tenant
        await this.notificationService.create({
          userId: booking.tenant.id,
          type: NotificationTypeEnum.GENERAL,
          title: '🛑 Hợp đồng đã bị hủy',
          content: `Hợp đồng thuê căn hộ ${booking.property.title} đã bị hủy do không đủ tiền ký quỹ để thanh toán phí phạt. Lý do: ${reason}`,
        });

        // Notify landlord
        if (booking.property?.landlord?.id) {
          await this.notificationService.create({
            userId: booking.property.landlord.id,
            type: NotificationTypeEnum.GENERAL,
            title: '🛑 Hợp đồng đã bị hủy',
            content: `Hợp đồng với người thuê ${booking.tenant.fullName} cho căn hộ ${booking.property.title} đã bị hủy do không đủ tiền ký quỹ. Lý do: ${reason}`,
          });
        }
      }

      this.logger.log(`✅ Contract ${contractId} terminated successfully due to insufficient funds`);
    } catch (error) {
      this.logger.error(`❌ Failed to terminate contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Check if penalty already exists for a specific period to avoid double penalties
   */
  private async checkExistingPenalty(
    contractId: string,
    penaltyType: 'OVERDUE_PAYMENT' | 'MONTHLY_PAYMENT' | 'LATE_DEPOSIT' | 'OTHER',
    overdueDate: Date,
    period?: string
  ): Promise<PenaltyRecord | null> {
    try {
      const query = this.penaltyRecordRepository
        .createQueryBuilder('penalty')
        .where('penalty.contractId = :contractId', { contractId })
        .andWhere('penalty.penaltyType = :penaltyType', { penaltyType })
        .andWhere('penalty.status IN (:...statuses)', { statuses: ['APPLIED', 'DISPUTED'] });

      if (period) {
        query.andWhere('penalty.period = :period', { period });
      } else {
        // For overdue payments, check if penalty exists for the same due date
        const overdueStr = formatVN(overdueDate, 'yyyy-MM-dd');
        query.andWhere('penalty.overdueDate = :overdueDate', { overdueDate: overdueStr });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error(`❌ Failed to check existing penalty:`, error);
      return null;
    }
  }

  /**
   * Record penalty in database for tracking and avoiding duplicates
   */
  private async recordPenaltyInDatabase(data: {
    contractId: string;
    bookingId?: string;
    tenantId: string;
    penaltyType: 'OVERDUE_PAYMENT' | 'MONTHLY_PAYMENT' | 'LATE_DEPOSIT' | 'OTHER';
    period?: string;
    overdueDate: Date;
    daysPastDue: number;
    originalAmount: number;
    penaltyAmount: number;
    penaltyRate: number;
    reason: string;
    appliedBy: string;
  }): Promise<PenaltyRecord> {
    try {
      const penaltyRecord = this.penaltyRecordRepository.create({
        contractId: data.contractId,
        tenantId: data.tenantId,
        penaltyType: data.penaltyType,
        period: data.period,
        overdueDate: data.overdueDate,
        daysPastDue: data.daysPastDue,
        originalAmount: data.originalAmount,
        penaltyAmount: data.penaltyAmount,
        penaltyRate: data.penaltyRate,
        reason: data.reason,
        status: 'APPLIED',
        appliedAt: vnNow(),
        appliedBy: data.appliedBy,
      });

      const saved = await this.penaltyRecordRepository.save(penaltyRecord);
      this.logger.log(`📝 Recorded penalty ${saved.id} in database`);
      return saved;
    } catch (error) {
      this.logger.error(`❌ Failed to record penalty in database:`, error);
      throw error;
    }
  }

  /**
   * Get penalty history for a contract
   */
  async getPenaltyHistoryForContract(contractId: string): Promise<PenaltyRecord[]> {
    try {
      return await this.penaltyRecordRepository.find({
        where: { contractId },
        order: { createdAt: 'DESC' },
        relations: ['contract'], // Removed 'booking' relation - use bookingId if needed
      });
    } catch (error) {
      this.logger.error(`❌ Failed to get penalty history for contract ${contractId}:`, error);
      return [];
    }
  }

}