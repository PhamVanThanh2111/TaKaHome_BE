import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatVN, vnNow } from '../../common/datetime';

import { BlockchainService } from '../blockchain/blockchain.service';
import { Booking } from '../booking/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Contract } from '../contract/entities/contract.entity';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationTypeEnum } from '../common/enums/notification-type.enum';
import { EscrowService } from '../escrow/escrow.service';
import { PenaltyRecord } from './entities/penalty-record.entity';
import { ContractTerminationService } from '../contract/contract-termination.service';

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
    private contractTerminationService: ContractTerminationService,
  ) {}

  /**
   * Apply penalty for overdue first payment with daily accumulation
   * - Day 1-2: Apply daily penalty (3% per day accumulated)
   * - Day 3+: Cancel contract automatically
   */
  async applyPaymentOverduePenalty(
    booking: Booking,
    daysPastDue: number,
    rentAmount?: number,
  ): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.firstRentDueAt) {
        this.logger.warn(
          `Cannot apply penalty: missing contract or due date for booking ${booking.id}`,
        );
        return null;
      }

      // Check if first payment is more than 3 days overdue - cancel booking
      if (daysPastDue >= 3 && !booking.firstRentPaidAt) {
        this.logger.warn(
          `⚠️ First payment is ${daysPastDue} days overdue for booking ${booking.id}. Cancelling booking as per business rule (3+ days).`,
        );

        return await this.cancelBookingForOverdueFirstPayment(
          booking,
          daysPastDue,
        );
      }

      // Get actual rent amount from blockchain contract first, then fallback to property or default
      const actualRentAmount = await this.getRentAmountFromBlockchain(
        booking.contractId,
        rentAmount || booking.property?.price || 10000000,
      );

      // Check if penalty already applied TODAY to avoid multiple penalties per day (similar to monthly payment logic)
      const today = vnNow();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      );

      const existingTodayPenalty = await this.penaltyRecordRepository
        .createQueryBuilder('penalty')
        .where('penalty.contractId = :contractId', {
          contractId: booking.contractId,
        })
        .andWhere('penalty.penaltyType = :penaltyType', {
          penaltyType: 'OVERDUE_PAYMENT',
        })
        .andWhere('penalty.appliedAt >= :startOfToday', { startOfToday })
        .andWhere('penalty.appliedAt < :endOfToday', { endOfToday })
        .getOne();

      if (existingTodayPenalty) {
        this.logger.log(
          `⚠️ Daily penalty already applied today for booking ${booking.id}, skipping...`,
        );
        return null;
      }

      // Calculate penalty based on Vietnam legal requirements
      const penaltyInfo = this.calculateOverduePenalty(
        daysPastDue,
        actualRentAmount,
      );

      this.logger.log(
        `Applying ${penaltyInfo.rate}% penalty for booking ${booking.id} (${daysPastDue} days overdue)`,
      );

      // Check escrow balance before applying penalty
      const escrowBalance = await this.checkEscrowBalance(booking.contractId);

      // Determine actual penalty amount to deduct and whether to terminate
      let actualPenaltyAmount = penaltyInfo.amount;
      let shouldTerminate = false;
      let terminationReason = '';

      // Check if contract should be terminated due to excessive penalties (30% rule)
      if (!penaltyInfo.canContinue) {
        shouldTerminate = true;
        terminationReason = `Tổng phạt vượt quá 30% giá trị hợp đồng. Penalty: ${penaltyInfo.amount.toLocaleString('vi-VN')} VND`;
        this.logger.warn(
          `⚠️ Penalty exceeds 30% rule for booking ${booking.id}. Will deduct available balance and terminate.`,
        );
      }

      // Check if penalty exceeds escrow balance
      if (escrowBalance && penaltyInfo.amount > escrowBalance.tenantBalance) {
        // Deduct all available balance instead of full penalty
        actualPenaltyAmount = escrowBalance.tenantBalance;
        shouldTerminate = true;
        terminationReason = `Không đủ tiền cọc để trả phạt. Penalty yêu cầu: ${penaltyInfo.amount.toLocaleString('vi-VN')} VND, Số dư khả dụng: ${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND. Đã trừ hết số dư.`;

        this.logger.warn(
          `⚠️ Penalty (${penaltyInfo.amount.toLocaleString('vi-VN')} VND) exceeds escrow balance (${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND) for booking ${booking.id}. Will deduct available balance and terminate.`,
        );
      }

      // Record penalty on blockchain with actual amount
      if (actualPenaltyAmount > 0) {
        await this.recordPenaltyOnBlockchain(
          booking.contract?.contractCode || booking.contractId,
          'tenant',
          actualPenaltyAmount,
          `Payment overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );

        // Deduct penalty from tenant's escrow balance
        await this.deductFromEscrow(
          booking.contractId,
          actualPenaltyAmount,
          `Payment overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );
      }

      // Terminate contract if needed (after deducting available funds)
      if (shouldTerminate) {
        this.logger.warn(
          `⚠️ Terminating contract for booking ${booking.id} after deducting available funds.`,
        );

        await this.terminateContractForInsufficientFunds(
          booking.contractId,
          booking.id,
          terminationReason,
        );

        // Still return penalty application to record what was deducted
        const penaltyApplication: PenaltyApplication = {
          contractId: booking.contractId,
          bookingId: booking.id,
          tenantId: booking.tenant.id,
          daysPastDue,
          originalAmount: actualRentAmount,
          penaltyAmount: actualPenaltyAmount,
          reason: `${terminationReason}. Contract terminated after deducting available funds.`,
          appliedAt: vnNow(),
        };

        return penaltyApplication;
      }

      // Send notifications with actual penalty amount
      await this.sendPenaltyNotifications(
        booking,
        { amount: actualPenaltyAmount, reason: penaltyInfo.reason },
        daysPastDue,
      );

      // Record penalty in database with actual amount
      await this.recordPenaltyInDatabase({
        contractId: booking.contract?.contractCode || booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        penaltyType: 'OVERDUE_PAYMENT',
        overdueDate: booking.firstRentDueAt,
        daysPastDue,
        originalAmount: actualRentAmount,
        penaltyAmount: actualPenaltyAmount, // Use actual deducted amount
        penaltyRate: penaltyInfo.rate,
        reason: `First payment overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND${actualPenaltyAmount < penaltyInfo.amount ? ' (Insufficient balance)' : ''}`,
        appliedBy: 'system',
      });

      const penaltyApplication: PenaltyApplication = {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        daysPastDue,
        originalAmount: actualRentAmount,
        penaltyAmount: actualPenaltyAmount, // Use actual deducted amount
        reason: `${penaltyInfo.reason} - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND${actualPenaltyAmount < penaltyInfo.amount ? ' (Insufficient balance)' : ''}`,
        appliedAt: vnNow(),
      };

      this.logger.log(
        `✅ Successfully applied penalty for booking ${booking.id} - Amount: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
      );
      return penaltyApplication;
    } catch (error) {
      this.logger.error(
        `❌ Failed to apply penalty for booking ${booking.id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Cancel booking and contract if deposit not paid within 24 hours
   */
  async cancelBookingForLateDeposit(
    booking: Booking,
  ): Promise<{ cancelled: boolean; reason: string } | null> {
    try {
      if (!booking.contractId || !booking.escrowDepositDueAt) {
        return null;
      }

      // const hoursLate = Math.floor(
      //   (vnNow().getTime() - booking.escrowDepositDueAt.getTime()) /
      //     (1000 * 60 * 60),
      // );
      const hoursLate = Math.floor(
        (vnNow().getTime() - booking.escrowDepositDueAt.getTime()) /
          (1000 * 60),
      ); //Demo: minutes

      // Cancel if more than 24 hours late
      if (hoursLate > 24) {
        // Cancel booking
        await this.contractTerminationService.terminateContract(
          booking.contractId,
          'Deposit not paid within 24 hours',
          'system',
        );

        this.logger.log(
          `✅ Booking ${booking.id} cancelled due to deposit not paid within 24 hours (${hoursLate}h late)`,
        );

        return {
          cancelled: true,
          reason: `Tiền cọc không được nộp trong vòng 24 giờ (trễ ${hoursLate} giờ)`,
        };
      }

      return null; // Not late enough to cancel yet
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel booking ${booking.id} for late deposit:`,
        error,
      );
      return null;
    }
  }

  /**
   * Cancel booking and contract if first payment not made within 3 days
   */
  async cancelBookingForOverdueFirstPayment(
    booking: Booking,
    daysPastDue: number,
  ): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.firstRentDueAt) {
        return null;
      }

      // Only cancel if first payment is overdue (not paid)
      if (booking.firstRentPaidAt) {
        this.logger.warn(
          `First payment already made for booking ${booking.id}, cannot cancel`,
        );
        return null;
      }

      // Use ContractTerminationService for proper escrow distribution
      const reason = `Không thanh toán lần đầu trong vòng 3 ngày (trễ ${daysPastDue} ngày)`;
      const terminationResult =
        await this.contractTerminationService.terminateContract(
          booking.contractId,
          reason,
          'system',
        );

      this.logger.log(
        `✅ Booking ${booking.id} cancelled due to first payment not made within 3 days with escrow refunds:`,
        {
          refundToTenant: terminationResult.calculation.refundToTenant,
          refundToLandlord: terminationResult.calculation.refundToLandlord,
        },
      );

      // Return a PenaltyApplication-like object for consistency (though it's a cancellation)
      return {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: booking.tenant.id,
        daysPastDue,
        originalAmount: booking.property?.price || 0,
        penaltyAmount: terminationResult.calculation.penaltyAmount,
        reason: `Hợp đồng đã bị hủy do không thanh toán lần đầu trong vòng 3 ngày (trễ ${daysPastDue} ngày). Hoàn trả: ${terminationResult.calculation.refundToTenant.toLocaleString('vi-VN')} VND`,
        appliedAt: vnNow(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel booking ${booking.id} for overdue first payment:`,
        error,
      );
      return null;
    }
  }

  /**
   * Calculate penalty for overdue payment based on Vietnam legal requirements
   */
  private calculateOverduePenalty(
    daysPastDue: number,
    rentAmount?: number,
  ): {
    rate: number;
    amount: number;
    reason: string;
    canContinue: boolean;
  } {
    // Vietnam legal requirement: Maximum 3% per day
    const rate = 3; // 3% per day as per Vietnamese law

    // Use actual rent amount or fallback to default
    const baseAmount = rentAmount || 10000000; // 10M VND as fallback
    const penaltyAmount = Math.floor((baseAmount * rate * daysPastDue) / 100);

    // Maximum penalty cap: 30% of contract value (Vietnamese consumer protection)
    const maxPenalty = Math.floor(baseAmount * 0.3);
    const finalPenalty = Math.min(penaltyAmount, maxPenalty);

    // Contract termination logic: If penalties exceed 30% of rent, recommend termination
    const canContinue = finalPenalty < baseAmount * 0.3;

    return {
      rate,
      amount: finalPenalty,
      reason: `Phạt chậm thanh toán ${daysPastDue} ngày, số tiền phạt: ${finalPenalty.toLocaleString('vi-VN')} VND`,
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
    daysPastDue: number,
  ): Promise<void> {
    // Notify tenant
    await this.notificationService.create({
      userId: booking.tenant.id,
      type: NotificationTypeEnum.PAYMENT,
      title: 'Phí phạt thanh toán lần đầu',
      content: `Do thanh toán lần đầu muộn ${daysPastDue} ngày cho căn hộ ${booking.property.title}, bạn đã bị áp dụng phí phạt ${penaltyInfo.amount.toLocaleString('vi-VN')} VND. Lưu ý: Nếu trễ quá 3 ngày, hợp đồng sẽ bị hủy!`,
    });

    // Notify landlord (if property has landlord relation)
    if (booking.property?.landlord?.id) {
      await this.notificationService.create({
        userId: booking.property.landlord.id,
        type: NotificationTypeEnum.PAYMENT,
        title: '💰 Phí phạt thanh toán lần đầu',
        content: `Phí phạt ${penaltyInfo.amount.toLocaleString('vi-VN')} VND đã được tự động áp dụng cho người thuê ${booking.tenant.fullName} do thanh toán lần đầu muộn ${daysPastDue} ngày. Nếu trễ quá 3 ngày, hợp đồng sẽ bị hủy.`,
      });
    }

    this.logger.log(`📨 Sent penalty notifications for booking ${booking.id}`);
  }

  /**
   * Get penalty history for a contract or booking
   */
  // async getPenaltyHistory(
  //   contractId?: string,
  //   bookingId?: string,
  // ): Promise<any[]> {
  //   // This would typically query a penalty history table or blockchain
  //   // For now, return empty array as placeholder
  //   this.logger.log(
  //     `Getting penalty history for contract: ${contractId}, booking: ${bookingId}`,
  //   );
  //   return [];
  // }

  /**
   * Calculate total penalties applied to a tenant
   */
  async getTotalPenaltiesForTenant(
    tenantId: string,
    fromDate?: Date,
  ): Promise<{
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

      const totalAmount = penalties.reduce(
        (sum, p) => sum + Number(p.penaltyAmount),
        0,
      );
      const lastPenalty = penalties.length > 0 ? penalties[0].appliedAt : null;

      return {
        totalAmount,
        penaltyCount: penalties.length,
        lastPenaltyDate: lastPenalty,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to get total penalties for tenant ${tenantId}:`,
        error,
      );
      return { totalAmount: 0, penaltyCount: 0, lastPenaltyDate: null };
    }
  }

  /**
   * Deduct penalty amount from escrow balance
   */
  private async deductFromEscrow(
    contractId: string,
    penaltyAmount: number,
    reason: string,
  ): Promise<void> {
    try {
      // Get escrow account for the contract
      const escrowResponse =
        await this.escrowService.ensureAccountForContract(contractId);
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
        `Penalty deduction: ${reason}`,
      );

      this.logger.log(
        `✅ Deducted ${penaltyAmount} VND from tenant escrow for contract ${contractId}: ${reason}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to deduct penalty from escrow for contract ${contractId}:`,
        error,
      );
      // Don't throw error to not break the penalty application process
    }
  }

  /**
   * Deduct penalty amount from landlord's escrow balance
   */
  private async deductFromLandlordEscrow(
    contractId: string,
    penaltyAmount: number,
    reason: string,
  ): Promise<void> {
    try {
      // Get escrow account for the contract
      const escrowResponse =
        await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        this.logger.warn(`No escrow account found for contract ${contractId}`);
        return;
      }

      // Deduct penalty amount from landlord's escrow balance
      await this.escrowService.deduct(
        escrow.id,
        penaltyAmount,
        'LANDLORD',
        `Penalty deduction: ${reason}`,
      );

      this.logger.log(
        `✅ Deducted ${penaltyAmount} VND from landlord escrow for contract ${contractId}: ${reason}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to deduct penalty from landlord escrow for contract ${contractId}:`,
        error,
      );
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
    reason: string,
  ): Promise<void> {
    try {
      // Create FabricUser for system operations (use landlord MSP)
      const fabricUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'orgMSP',
      };

      await this.blockchainService.recordPenalty(
        contractId,
        party,
        amount.toString(),
        reason,
        fabricUser,
      );

      this.logger.log(
        `✅ Penalty recorded on blockchain for contract ${contractId}: ${amount} VND`,
      );
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
      this.logger.log(
        '🔍 Processing overdue payments for penalty application...',
      );

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
            // const daysPastDue = Math.floor(
            //   (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
            // );
            //Demo
            const daysPastDue = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60),
            );

            if (daysPastDue > 0) {
              this.logger.log(
                `📅 Found overdue payment: booking ${booking.id}, ${daysPastDue} days past due`,
              );

              const penalty = await this.applyPaymentOverduePenalty(
                booking,
                daysPastDue,
              );
              if (penalty) {
                penaltiesApplied++;
              }
            }
          }
        }
      }

      this.logger.log(
        `✅ Processed overdue payments: ${penaltiesApplied} penalties applied`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to process overdue payments:', error);
    }
  }

  /**
   * Check and apply automatic penalties for overdue monthly payments from blockchain
   */
  async processMonthlyOverduePayments(): Promise<void> {
    try {
      this.logger.log(
        '🔍 Processing monthly overdue payments from blockchain...',
      );

      // Create system user for blockchain queries
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };
      // Query both SCHEDULED and OVERDUE payments from blockchain
      const scheduledResponse =
        await this.blockchainService.queryPaymentsByStatus(
          'SCHEDULED',
          systemUser,
        );
      const overdueResponse =
        await this.blockchainService.queryPaymentsByStatus(
          'OVERDUE',
          systemUser,
        );

      const allPayments = [
        ...(scheduledResponse.success ? scheduledResponse.data || [] : []),
        ...(overdueResponse.success ? overdueResponse.data || [] : []),
      ];

      if (allPayments.length === 0) {
        return;
      }

      // Filter for overdue payments (both SCHEDULED past due and existing OVERDUE)
      const now = vnNow();
      const overduePayments = allPayments.filter((payment) => {
        const dueDate = new Date(payment.dueDate!);
        return now > dueDate;
      });

      let penaltiesApplied = 0;
      for (const payment of overduePayments) {
        try {
          this.logger.log(
            `🔍 Processing payment: ${JSON.stringify({ contractId: payment.contractId, period: payment.period, status: payment.status, dueDate: payment.dueDate })}`,
          );
          // Skip first payment (period 1) as it's handled by processOverduePayments
          if (payment.period <= 1) {
            continue;
          }

          // Find corresponding contract in database
          this.logger.log(
            `🔎 Looking for contract with contractCode: ${payment.contractId}`,
          );
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
          const daysPastDue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysPastDue > 0) {
            // Check if penalty already applied TODAY to avoid multiple penalties per day
            const today = vnNow();
            const startOfToday = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            );
            const endOfToday = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() + 1,
            );

            const existingTodayPenalty = await this.penaltyRecordRepository
              .createQueryBuilder('penalty')
              .where('penalty.contractId = :contractId', {
                contractId: contract.id,
              })
              .andWhere('penalty.penaltyType = :penaltyType', {
                penaltyType: 'MONTHLY_PAYMENT',
              })
              .andWhere('penalty.period = :period', {
                period: payment.period.toString(),
              })
              .andWhere('penalty.appliedAt >= :startOfToday', { startOfToday })
              .andWhere('penalty.appliedAt < :endOfToday', { endOfToday })
              .getOne();

            if (existingTodayPenalty) {
              this.logger.log(
                `⚠️ Daily penalty already applied today for contract ${contract.contractCode} period ${payment.period}, skipping...`,
              );
              continue;
            }

            // Check if this is the FIRST penalty for this period
            const existingPenaltyForPeriod =
              await this.penaltyRecordRepository.findOne({
                where: {
                  contractId: contract.id,
                  penaltyType: 'MONTHLY_PAYMENT',
                  period: payment.period.toString(),
                },
              });

            const isFirstPenalty = !existingPenaltyForPeriod;

            // Step 1: Mark payment as overdue on blockchain (only if SCHEDULED)
            if (payment.status === 'SCHEDULED') {
              await this.blockchainService.markOverdue(
                payment.contractId,
                payment.period.toString(),
                systemUser,
              );
            }

            // Step 2: Apply penalty and deduct from escrow (pass isFirstPenalty flag)
            const penalty = await this.applyMonthlyPaymentOverduePenalty(
              contract,
              payment.period.toString(),
              daysPastDue,
              payment.amount,
              isFirstPenalty,
            );

            if (penalty) {
              penaltiesApplied++;
            }
          }
        } catch (error) {
          this.logger.error(
            `❌ Failed to process overdue payment ${payment.contractId} period ${payment.period}:`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ Processed monthly overdue payments: ${penaltiesApplied} penalties applied`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to process monthly overdue payments:',
        error,
      );
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
    originalAmount: number,
    isFirstPenalty: boolean = false,
  ): Promise<PenaltyApplication | null> {
    try {
      if (!contract.contractCode) {
        return null;
      }

      // Calculate penalty based on business rules with actual rent amount
      const penaltyInfo = this.calculateOverduePenalty(
        daysPastDue,
        originalAmount,
      );

      this.logger.log(
        `Applying ${penaltyInfo.rate}% penalty for contract ${contract.contractCode} period ${period} (${daysPastDue} days overdue)`,
      );

      // Check escrow balance before applying penalty
      const escrowBalance = await this.checkEscrowBalance(contract.id);

      // Determine actual penalty amount to deduct and whether to terminate
      let actualPenaltyAmount = penaltyInfo.amount;
      let shouldTerminate = false;
      let terminationReason = '';

      // Check if contract should be terminated due to excessive penalties (30% rule)
      if (!penaltyInfo.canContinue) {
        shouldTerminate = true;
        terminationReason = `Tổng phạt vượt quá 30% giá trị hợp đồng. Penalty: ${penaltyInfo.amount.toLocaleString('vi-VN')} VND`;
        this.logger.warn(
          `⚠️ Penalty exceeds 30% rule for contract ${contract.contractCode} period ${period}. Will deduct available balance and terminate.`,
        );
      }

      // Check if penalty exceeds escrow balance
      if (escrowBalance && penaltyInfo.amount > escrowBalance.tenantBalance) {
        // Deduct all available balance instead of full penalty
        actualPenaltyAmount = escrowBalance.tenantBalance;
        shouldTerminate = true;
        terminationReason = `Không đủ tiền cọc để trả phạt. Penalty yêu cầu: ${penaltyInfo.amount.toLocaleString('vi-VN')} VND, Số dư khả dụng: ${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND. Đã trừ hết số dư.`;

        this.logger.warn(
          `⚠️ Penalty (${penaltyInfo.amount.toLocaleString('vi-VN')} VND) exceeds escrow balance (${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND) for contract ${contract.contractCode} period ${period}. Will deduct available balance and terminate.`,
        );
      }

      // Deduct the actual penalty amount (either full penalty or available balance)
      if (actualPenaltyAmount > 0) {
        await this.deductFromEscrow(
          contract.id,
          actualPenaltyAmount,
          `Monthly payment period ${period} overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );
      }

      // Terminate contract if needed (after deducting available funds)
      if (shouldTerminate) {
        this.logger.warn(
          `⚠️ Terminating contract ${contract.contractCode} period ${period} after deducting available funds.`,
        );

        await this.terminateContractForInsufficientFunds(
          contract.id,
          '', // No bookingId for monthly payments
          terminationReason,
        );

        // Still return penalty application to record what was deducted
        const penaltyApplication: PenaltyApplication = {
          contractId: contract.id,
          bookingId: '',
          tenantId: contract.tenant.id,
          daysPastDue,
          originalAmount: originalAmount,
          penaltyAmount: actualPenaltyAmount,
          reason: `${terminationReason}. Contract terminated after deducting available funds.`,
          appliedAt: vnNow(),
        };

        return penaltyApplication;
      }

      // Create system user for blockchain operations
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      if (isFirstPenalty) {
        // First penalty: Use applyPenalty to mark the payment period as penalized
        this.logger.log(
          `🥇 First penalty for contract ${contract.contractCode} period ${period} - using applyPenalty - Amount: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );
        await this.blockchainService.applyPenalty(
          contract.contractCode,
          period,
          actualPenaltyAmount.toString(),
          'MONTHLY_PAYMENT_OVERDUE',
          `Monthly payment period ${period} overdue by ${daysPastDue} days - First penalty - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
          systemUser,
        );
      } else {
        // Subsequent penalties: Use recordPenalty for daily tracking
        this.logger.log(
          `📅 Daily penalty for contract ${contract.contractCode} period ${period} - using recordPenalty - Amount: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );
        await this.recordPenaltyOnBlockchain(
          contract.contractCode,
          'tenant',
          actualPenaltyAmount,
          `Monthly payment period ${period} overdue by ${daysPastDue} days - Daily penalty - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
        );
      }

      // Record penalty in database with period for tracking
      await this.recordPenaltyInDatabase({
        contractId: contract.id,
        tenantId: contract.tenant.id,
        penaltyType: 'MONTHLY_PAYMENT',
        period: period,
        overdueDate: new Date(), // Current date as overdue date for tracking
        daysPastDue: daysPastDue,
        originalAmount: originalAmount,
        penaltyAmount: actualPenaltyAmount, // Use actual deducted amount
        penaltyRate: 3, // 3% per day
        reason: `Monthly payment period ${period} overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND${actualPenaltyAmount < penaltyInfo.amount ? ' (Insufficient balance)' : ''}`,
        appliedBy: 'system',
      });

      // Send notifications
      this.logger.log(
        `📨 Sending penalty notifications for contract ${contract.contractCode} period ${period}`,
      );
      await this.sendMonthlyPaymentPenaltyNotifications(
        contract,
        period,
        actualPenaltyAmount, // Use actual deducted amount for notifications
        daysPastDue,
      );

      const penaltyApplication: PenaltyApplication = {
        contractId: contract.id,
        bookingId: '', // Monthly payments don't have booking reference
        tenantId: contract.tenant.id,
        daysPastDue,
        originalAmount: originalAmount,
        penaltyAmount: actualPenaltyAmount, // Use actual deducted amount
        reason: `Monthly payment period ${period} overdue by ${daysPastDue} days - Deducted: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND${actualPenaltyAmount < penaltyInfo.amount ? ' (Insufficient balance)' : ''}`,
        appliedAt: vnNow(),
      };

      this.logger.log(
        `✅ Successfully applied monthly penalty for contract ${contract.contractCode} period ${period} - Amount: ${actualPenaltyAmount.toLocaleString('vi-VN')} VND`,
      );
      return penaltyApplication;
    } catch (error) {
      this.logger.error(
        `❌ Failed to apply monthly payment penalty for contract ${contract.contractCode} period ${period}:`,
        error,
      );
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
    daysPastDue: number,
  ): Promise<void> {
    const periodDisplay = `tháng ${period}`;

    await this.notificationService.create({
      userId: contract.tenant.id,
      type: NotificationTypeEnum.PAYMENT,
      title: 'Phí phạt thanh toán hàng tháng',
      content: `Do thanh toán muộn ${daysPastDue} ngày cho ${periodDisplay} của căn hộ ${contract.property.title}, bạn đã bị áp dụng phí phạt ${penaltyAmount.toLocaleString('vi-VN')} VND. Vui lòng thanh toán sớm để tránh thêm phí phạt.`,
    });

    await this.notificationService.create({
      userId: contract.landlord.id,
      type: NotificationTypeEnum.PAYMENT,
      title: '💰 Phí phạt thanh toán hàng tháng',
      content: `Phí phạt ${penaltyAmount.toLocaleString('vi-VN')} VND đã được tự động áp dụng cho người thuê ${contract.tenant.fullName} do thanh toán muộn ${daysPastDue} ngày cho ${periodDisplay} của căn hộ ${contract.property.title}.`,
    });

    this.logger.log(
      `📨 Sent monthly payment penalty notifications for contract ${contract.contractCode} period ${period}`,
    );
  }

  /**
   * Check escrow balance for a contract
   */
  private async checkEscrowBalance(
    contractId: string,
  ): Promise<{ tenantBalance: number; landlordBalance: number } | null> {
    try {
      const escrowResponse =
        await this.escrowService.ensureAccountForContract(contractId);
      const escrow = escrowResponse.data;

      if (!escrow) {
        return null;
      }

      return {
        tenantBalance: parseInt(escrow.currentBalanceTenant || '0'),
        landlordBalance: parseInt(escrow.currentBalanceLandlord || '0'),
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to check escrow balance for contract ${contractId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Terminate contract when escrow funds are insufficient
   * Now uses ContractTerminationService for proper escrow refund distribution
   */
  private async terminateContractForInsufficientFunds(
    contractId: string,
    bookingId: string,
    reason: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Terminating contract ${contractId} due to insufficient funds: ${reason}`,
      );

      // Use ContractTerminationService for proper escrow distribution
      const terminationResult =
        await this.contractTerminationService.terminateContract(
          contractId,
          reason,
          'system',
        );

      this.logger.log(
        `✅ Contract ${contractId} terminated successfully with escrow refunds processed:`,
        {
          refundToTenant: terminationResult.calculation.refundToTenant,
          refundToLandlord: terminationResult.calculation.refundToLandlord,
          penaltyAmount: terminationResult.calculation.penaltyAmount,
        },
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to terminate contract ${contractId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if penalty already exists for a specific period to avoid double penalties
   */
  private async checkExistingPenalty(
    contractId: string,
    penaltyType:
      | 'OVERDUE_PAYMENT'
      | 'MONTHLY_PAYMENT'
      | 'LATE_DEPOSIT'
      | 'HANDOVER_OVERDUE'
      | 'OTHER',
    overdueDate: Date,
    period?: string,
  ): Promise<PenaltyRecord | null> {
    try {
      const query = this.penaltyRecordRepository
        .createQueryBuilder('penalty')
        .where('penalty.contractId = :contractId', { contractId })
        .andWhere('penalty.penaltyType = :penaltyType', { penaltyType })
        .andWhere('penalty.status IN (:...statuses)', {
          statuses: ['APPLIED', 'DISPUTED'],
        });

      if (period) {
        query.andWhere('penalty.period = :period', { period });
      } else {
        // For overdue payments, check if penalty exists for the same due date
        const overdueStr = formatVN(overdueDate, 'yyyy-MM-dd');
        query.andWhere('penalty.overdueDate = :overdueDate', {
          overdueDate: overdueStr,
        });
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
    penaltyType:
      | 'OVERDUE_PAYMENT'
      | 'MONTHLY_PAYMENT'
      | 'LATE_DEPOSIT'
      | 'HANDOVER_OVERDUE'
      | 'OTHER';
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
  async getPenaltyHistoryForContract(
    contractId: string,
  ): Promise<PenaltyRecord[]> {
    try {
      return await this.penaltyRecordRepository.find({
        where: { contractId },
        order: { createdAt: 'DESC' },
        relations: ['contract'], // Removed 'booking' relation - use bookingId if needed
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to get penalty history for contract ${contractId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get rent amount from blockchain contract, fallback to provided default
   */
  private async getRentAmountFromBlockchain(
    contractId: string,
    fallbackAmount: number,
  ): Promise<number> {
    try {
      // Find contract to get contractCode
      const contract = await this.contractRepository.findOne({
        where: { id: contractId },
      });

      if (!contract?.contractCode) {
        this.logger.warn(
          `Contract ${contractId} not found or missing contractCode, using fallback amount`,
        );
        return fallbackAmount;
      }

      // Create system user for blockchain operations
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      // Get contract details from blockchain
      const blockchainResponse = await this.blockchainService.getContract(
        contract.contractCode,
        systemUser,
      );

      if (blockchainResponse.success && blockchainResponse.data) {
        const blockchainRentAmount = blockchainResponse.data.rentAmount;
        const rentAmount =
          typeof blockchainRentAmount === 'string'
            ? parseFloat(blockchainRentAmount)
            : blockchainRentAmount;

        if (rentAmount && rentAmount > 0) {
          this.logger.log(
            `✅ Retrieved rent amount from blockchain for contract ${contract.contractCode}: ${rentAmount.toLocaleString('vi-VN')} VND`,
          );
          return rentAmount;
        }
      }

      this.logger.warn(
        `❌ Failed to get rent amount from blockchain for contract ${contract.contractCode}, using fallback`,
      );
      return fallbackAmount;
    } catch (error) {
      this.logger.error(
        `❌ Error getting rent amount from blockchain for contract ${contractId}:`,
        error,
      );
      return fallbackAmount;
    }
  }

  /**
   * Process handover deadline violations - penalty for landlords who don't handover within 24 hours
   */
  async processOverdueHandovers(): Promise<void> {
    try {
      this.logger.log('🏠 Checking for overdue handovers...');

      const now = vnNow();
      //const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 1000); //Demo: 24 minutes ago
      // Find bookings that are READY_FOR_HANDOVER and first rent was paid more than 24 hours ago
      const overdueHandovers = await this.bookingRepository.find({
        where: {
          status: BookingStatus.READY_FOR_HANDOVER,
        },
        relations: ['tenant', 'property', 'property.landlord', 'contract'],
      });

      let penaltiesApplied = 0;

      for (const booking of overdueHandovers) {
        if (
          booking.firstRentPaidAt &&
          booking.firstRentPaidAt <= twentyFourHoursAgo
        ) {
          // const hoursOverdue = Math.floor(
          //   (now.getTime() - booking.firstRentPaidAt.getTime()) /
          //     (1000 * 60 * 60),
          // );
          const hoursOverdue = Math.floor(
            (now.getTime() - booking.firstRentPaidAt.getTime()) / (1000 * 60),
          ); //Demo: minutes

          if (hoursOverdue >= 24) {
            this.logger.log(
              `📅 Found overdue handover: booking ${booking.id}, ${hoursOverdue} hours past due (landlord: ${booking.property?.landlord?.id})`,
            );

            const penalty = await this.applyLandlordHandoverPenalty(
              booking,
              hoursOverdue,
            );
            if (penalty) {
              penaltiesApplied++;
            }
          }
        }
      }

      this.logger.log(
        `✅ Processed overdue handovers: ${penaltiesApplied} landlord penalties applied`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to process overdue handovers:', error);
    }
  }

  /**
   * Process pending signature timeouts - cancel bookings if tenant doesn't sign within 30 minutes
   */
  async processPendingSignatureTimeouts(): Promise<void> {
    try {
      this.logger.log('📝 Checking for pending signature timeouts...');

      const now = vnNow();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      // Find bookings that are PENDING_SIGNATURE and created more than 30 minutes ago
      const timeoutBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.PENDING_SIGNATURE,
        },
        relations: ['tenant', 'property', 'property.landlord', 'contract'],
      });

      let cancelledBookings = 0;

      for (const booking of timeoutBookings) {
        // Check if booking was updated to PENDING_SIGNATURE more than 30 minutes ago
        if (booking.updatedAt <= thirtyMinutesAgo) {
          const minutesOverdue = Math.floor(
            (now.getTime() - booking.updatedAt.getTime()) / (1000 * 60),
          );

          this.logger.log(
            `📅 Found pending signature timeout: booking ${booking.id}, ${minutesOverdue} minutes overdue`,
          );

          const cancelled = await this.cancelBookingForPendingSignatureTimeout(
            booking,
            minutesOverdue,
          );
          if (cancelled) {
            cancelledBookings++;
          }
        }
      }

      this.logger.log(
        `✅ Processed pending signature timeouts: ${cancelledBookings} bookings cancelled`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to process pending signature timeouts:',
        error,
      );
    }
  }

  /**
   * Cancel booking and contract if tenant doesn't sign within 30 minutes
   */
  async cancelBookingForPendingSignatureTimeout(
    booking: Booking,
    minutesOverdue: number,
  ): Promise<boolean> {
    try {
      if (!booking.contractId) {
        this.logger.warn(
          `Cannot cancel booking for signature timeout: missing contract for booking ${booking.id}`,
        );
        return false;
      }

      // Use ContractTerminationService for proper cleanup
      const reason = `Tenant không ký hợp đồng trong vòng 30 phút (trễ ${minutesOverdue} phút)`;
      await this.contractTerminationService.terminateContract(
        booking.contractId,
        reason,
        'system',
      );

      // Send notifications to both parties
      await this.sendPendingSignatureTimeoutNotifications(
        booking,
        minutesOverdue,
      );

      this.logger.log(
        `✅ Booking ${booking.id} cancelled due to pending signature timeout (${minutesOverdue} minutes)`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel booking ${booking.id} for pending signature timeout:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send notifications for pending signature timeout cancellation
   */
  private async sendPendingSignatureTimeoutNotifications(
    booking: Booking,
    minutesOverdue: number,
  ): Promise<void> {
    try {
      const tenantId = booking.tenant?.id;
      const landlordId = booking.property?.landlord?.id;

      // Notify tenant about cancellation
      if (tenantId) {
        await this.notificationService.create({
          userId: tenantId,
          type: NotificationTypeEnum.GENERAL,
          title: '⏰ Hợp đồng đã bị hủy do quá hạn ký',
          content: `Hợp đồng thuê căn hộ ${booking.property?.title} đã bị hủy tự động do bạn không ký trong vòng 30 phút. Thời gian trễ: ${minutesOverdue} phút. Bạn có thể tạo yêu cầu thuê mới nếu vẫn muốn thuê căn hộ này.`,
        });
      }

      // Notify landlord about cancellation
      if (landlordId) {
        await this.notificationService.create({
          userId: landlordId,
          type: NotificationTypeEnum.GENERAL,
          title: '⏰ Hợp đồng đã bị hủy do tenant không ký',
          content: `Hợp đồng thuê với ${booking.tenant?.fullName} cho căn hộ ${booking.property?.title} đã bị hủy tự động do tenant không ký trong vòng 30 phút. Căn hộ hiện đã sẵn sàng cho thuê lại.`,
        });
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to send pending signature timeout notifications:',
        error,
      );
    }
  }

  /**
   * Apply penalty to landlord for not handing over within 24 hours
   * Deduct 10% of landlord deposit and cancel contract
   */
  async applyLandlordHandoverPenalty(
    booking: Booking,
    hoursOverdue: number,
  ): Promise<PenaltyApplication | null> {
    try {
      if (!booking.contractId || !booking.firstRentPaidAt) {
        this.logger.warn(
          `Cannot apply handover penalty: missing contract or payment date for booking ${booking.id}`,
        );
        return null;
      }

      const landlordId = booking.property?.landlord?.id;
      if (!landlordId) {
        this.logger.warn(
          `Cannot apply handover penalty: missing landlord for booking ${booking.id}`,
        );
        return null;
      }

      // Check if penalty already exists to avoid double penalty
      const existingPenalty = await this.checkExistingPenalty(
        booking.contractId,
        'HANDOVER_OVERDUE',
        booking.firstRentPaidAt,
      );

      if (existingPenalty) {
        this.logger.warn(
          `Handover penalty already applied for booking ${booking.id} on ${formatVN(existingPenalty.appliedAt, 'yyyy-MM-dd')}`,
        );
        return null;
      }

      // Get landlord's escrow balance
      const escrowBalance = await this.checkEscrowBalance(booking.contractId);
      if (!escrowBalance || escrowBalance.landlordBalance <= 0) {
        this.logger.warn(
          `No landlord escrow balance found for contract ${booking.contractId}`,
        );
        return null;
      }

      // Calculate 10%% penalty of landlord deposit
      const penaltyAmount = Math.floor(escrowBalance.landlordBalance * 0.1);
      const reason = `Chủ nhà không bàn giao trong vòng 24 giờ (trễ ${hoursOverdue} giờ)`;

      this.logger.log(
        `Applying 10% deposit penalty (${penaltyAmount.toLocaleString('vi-VN')} VND) to landlord for booking ${booking.id}`,
      );

      // Record penalty on blockchain
      await this.recordPenaltyOnBlockchain(
        booking.contract?.contractCode || booking.contractId,
        'landlord',
        penaltyAmount,
        reason,
      );

      // Deduct penalty from landlord's escrow balance
      await this.deductFromLandlordEscrow(
        booking.contractId,
        penaltyAmount,
        reason,
      );

      // Send notifications
      await this.sendHandoverPenaltyNotifications(
        booking,
        penaltyAmount,
        hoursOverdue,
      );

      // Record penalty in database
      await this.recordPenaltyInDatabase({
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: landlordId, // Using landlordId as the penalized party
        penaltyType: 'HANDOVER_OVERDUE',
        overdueDate: booking.firstRentPaidAt,
        daysPastDue: Math.floor(hoursOverdue / 24),
        originalAmount: escrowBalance.landlordBalance,
        penaltyAmount: penaltyAmount,
        penaltyRate: 10, // 10% penalty
        reason: reason,
        appliedBy: 'system',
      });

      // Cancel booking and terminate contract due to landlord violation
      this.logger.warn(
        `⚠️ Cancelling booking ${booking.id} due to landlord handover violation`,
      );

      const terminationResult =
        await this.contractTerminationService.terminateContract(
          booking.contractId,
          reason,
          'LANDLORD_VIOLATION',
        );

      const penaltyApplication: PenaltyApplication = {
        contractId: booking.contractId,
        bookingId: booking.id,
        tenantId: landlordId,
        daysPastDue: Math.floor(hoursOverdue / 24),
        originalAmount: escrowBalance.landlordBalance,
        penaltyAmount: penaltyAmount,
        reason: `${reason}. Contract terminated. Refund: ${terminationResult.calculation.refundToTenant.toLocaleString('vi-VN')} VND to tenant`,
        appliedAt: vnNow(),
      };

      return penaltyApplication;
    } catch (error) {
      this.logger.error(
        `❌ Failed to apply landlord handover penalty for booking ${booking.id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Send notifications for handover penalty
   */
  private async sendHandoverPenaltyNotifications(
    booking: Booking,
    penaltyAmount: number,
    hoursOverdue: number,
  ): Promise<void> {
    try {
      const landlordId = booking.property?.landlord?.id;
      const tenantId = booking.tenant?.id;

      // Notify landlord about penalty
      if (landlordId) {
        await this.notificationService.create({
          userId: landlordId,
          type: NotificationTypeEnum.PENALTY,
          title: '⚠️ Phạt chậm bàn giao',
          content: `Bạn đã bị phạt ${penaltyAmount.toLocaleString('vi-VN')} VND (10% cọc) do không bàn giao căn hộ ${booking.property?.title} trong vòng 24 giờ. Thời gian trễ: ${hoursOverdue} giờ. Hợp đồng đã bị hủy.`,
        });
      }

      // Notify tenant about landlord violation and refund
      if (tenantId) {
        await this.notificationService.create({
          userId: tenantId,
          type: NotificationTypeEnum.GENERAL,
          title: '🏠 Hủy hợp đồng do chủ nhà vi phạm',
          content: `Hợp đồng thuê căn hộ ${booking.property?.title} đã bị hủy do chủ nhà không bàn giao đúng hạn. Bạn sẽ được hoàn tiền đầy đủ cọc và tiền thuê đã thanh toán.`,
        });
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to send handover penalty notifications:',
        error,
      );
    }
  }

  /**
   * Check for low escrow balance and send warning notifications
   * Warns tenant when balance < 3x expected penalty amount
   */
  async checkLowEscrowBalance(): Promise<void> {
    try {
      this.logger.log('🔍 Checking for low escrow balances...');

      // 1. Find all active contracts
      const activeContracts = await this.contractRepository.find({
        where: {
          status: ContractStatusEnum.ACTIVE,
        },
        relations: ['tenant', 'landlord', 'property'],
      });

      let warningsCount = 0;

      for (const contract of activeContracts) {
        try {
          // 2. Check escrow balance
          const escrowBalance = await this.checkEscrowBalance(contract.id);
          if (!escrowBalance || escrowBalance.tenantBalance <= 0) {
            continue; // Skip if no escrow or zero balance
          }

          // 3. Calculate expected penalty (3% per day for 1 day)
          const rentAmount = await this.getRentAmountFromBlockchain(
            contract.id,
            contract.property?.price || 10000000,
          );

          // Calculate daily penalty rate (3% per day)
          const dailyPenalty = Math.floor((rentAmount * 3) / 100);

          // Warning threshold: 3x daily penalty amount
          const warningThreshold = dailyPenalty * 3;

          // 4. Send warning if balance < threshold
          if (escrowBalance.tenantBalance < warningThreshold) {
            const daysRemaining = Math.floor(
              escrowBalance.tenantBalance / dailyPenalty,
            );

            // Check if warning already sent today to avoid spam
            const today = vnNow();
            const startOfToday = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            );
            const endOfToday = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() + 1,
            );

            const existingWarning = await this.penaltyRecordRepository
              .createQueryBuilder('penalty')
              .where('penalty.contractId = :contractId', {
                contractId: contract.id,
              })
              .andWhere('penalty.penaltyType = :penaltyType', {
                penaltyType: 'OTHER',
              })
              .andWhere('penalty.reason LIKE :reason', {
                reason: '%Low balance warning%',
              })
              .andWhere('penalty.appliedAt >= :startOfToday', { startOfToday })
              .andWhere('penalty.appliedAt < :endOfToday', { endOfToday })
              .getOne();

            if (!existingWarning) {
              await this.sendLowBalanceWarning(
                contract,
                escrowBalance.tenantBalance,
                warningThreshold,
                daysRemaining,
                dailyPenalty,
              );

              // Record warning to avoid duplicate notifications
              await this.recordPenaltyInDatabase({
                contractId: contract.id,
                tenantId: contract.tenant.id,
                penaltyType: 'OTHER',
                overdueDate: today,
                daysPastDue: 0,
                originalAmount: rentAmount,
                penaltyAmount: 0, // No actual penalty, just warning
                penaltyRate: 0,
                reason: `Low balance warning: ${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND < ${warningThreshold.toLocaleString('vi-VN')} VND threshold`,
                appliedBy: 'system',
              });

              warningsCount++;
              this.logger.log(
                `⚠️ Sent low balance warning for contract ${contract.contractCode}: Balance ${escrowBalance.tenantBalance.toLocaleString('vi-VN')} VND < Threshold ${warningThreshold.toLocaleString('vi-VN')} VND`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `❌ Failed to check balance for contract ${contract.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ Completed low escrow balance check: ${warningsCount} warnings sent for ${activeContracts.length} contracts`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to check low escrow balances:', error);
    }
  }

  /**
   * Send low balance warning notifications
   */
  private async sendLowBalanceWarning(
    contract: Contract,
    currentBalance: number,
    threshold: number,
    daysRemaining: number,
    dailyPenalty: number,
  ): Promise<void> {
    try {
      const tenantId = contract.tenant.id;
      const landlordId = contract.landlord.id;

      // Calculate recommended top-up amount (to reach 7 days of penalties)
      const recommendedTopUp = dailyPenalty * 7 - currentBalance;

      // Notify tenant with actionable warning
      await this.notificationService.create({
        userId: tenantId,
        type: NotificationTypeEnum.PAYMENT,
        title: '⚠️ Cảnh báo số dư escrow thấp',
        content: `Số dư escrow của bạn (${currentBalance.toLocaleString('vi-VN')} VND) đang thấp hơn ngưỡng an toàn (${threshold.toLocaleString('vi-VN')} VND). 
        
Với mức phạt hiện tại ${dailyPenalty.toLocaleString('vi-VN')} VND/ngày, số dư chỉ đủ cho ${daysRemaining} ngày phạt.

⚠️ NGUY CƠ: Nếu thanh toán trễ và số dư không đủ trả phạt, hợp đồng sẽ bị hủy tự động!

💡 ĐỀ XUẤT: Nộp thêm ${recommendedTopUp > 0 ? recommendedTopUp.toLocaleString('vi-VN') : '0'} VND để đảm bảo an toàn cho 7 ngày.`,
      });

      // Notify landlord for awareness
      await this.notificationService.create({
        userId: landlordId,
        type: NotificationTypeEnum.GENERAL,
        title: '💰 Số dư escrow tenant thấp',
        content: `Tenant ${contract.tenant.fullName} có số dư escrow thấp (${currentBalance.toLocaleString('vi-VN')} VND) cho căn hộ ${contract.property.title}. 
        
Có nguy cơ hợp đồng bị hủy nếu tenant thanh toán trễ và không đủ tiền trả phạt. Bạn có thể nhắc nhở tenant nộp thêm tiền cọc.`,
      });

      this.logger.log(
        `📨 Sent low balance warnings for contract ${contract.contractCode}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to send low balance warning notifications:',
        error,
      );
    }
  }
}
