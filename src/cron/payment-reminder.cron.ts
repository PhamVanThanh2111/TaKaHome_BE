import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, IsNull } from 'typeorm';
import { addDays } from 'date-fns';

import { BookingService } from '../modules/booking/booking.service';
import { NotificationService } from '../modules/notification/notification.service';
import { AutomatedPenaltyService } from '../modules/penalty/automated-penalty.service';

import { Booking } from '../modules/booking/entities/booking.entity';
import { Contract } from '../modules/contract/entities/contract.entity';
import { BookingStatus } from '../modules/common/enums/booking-status.enum';
import { ContractStatusEnum } from '../modules/common/enums/contract-status.enum';
import { NotificationTypeEnum } from '../modules/common/enums/notification-type.enum';
import { vnNow, addDaysVN, formatVN } from '../common/datetime';

/**
 * Payment Reminder Cron Jobs
 * Handles automated payment reminders and overdue processing
 */
@Injectable()
export class PaymentReminderCron {
  private readonly logger = new Logger(PaymentReminderCron.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    
    private bookingService: BookingService,
    private notificationService: NotificationService,
    private automatedPenaltyService: AutomatedPenaltyService,
  ) {}

  /**
   * Chạy mỗi giờ để gửi payment reminders
   * Sends payment reminders 7, 3, 1 days before due date
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendPaymentReminders(): Promise<void> {
    try {
      this.logger.log('🔔 Checking for payment reminders to send...');

      const now = vnNow();
      
      // Find active bookings with upcoming first rent payments
      const upcomingPayments = await this.bookingRepository.find({
        where: [
          {
            status: BookingStatus.ACTIVE,
            firstRentDueAt: MoreThan(now),
            firstRentPaidAt: IsNull(), // Not paid yet
          },
          {
            status: BookingStatus.READY_FOR_HANDOVER,
            firstRentDueAt: MoreThan(now),
            firstRentPaidAt: IsNull(),
          }
        ],
        relations: ['tenant', 'property'],
      });

      for (const booking of upcomingPayments) {
        if (!booking.firstRentDueAt) continue;

        const daysToDue = Math.ceil(
          (booking.firstRentDueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send reminders at specific intervals
        if ([7, 3, 1].includes(daysToDue)) {
          await this.sendPaymentReminder(booking, daysToDue);
        }
      }

      // Check deposit reminders and cancel overdue deposits
      await this.sendDepositReminders();
      await this.cancelOverdueDeposits();
      
      this.logger.log(`✅ Processed ${upcomingPayments.length} upcoming payments`);
    } catch (error) {
      this.logger.error('❌ Error in payment reminder cron:', error);
    }
  }

  /**
   * Chạy mỗi 6 tiếng để kiểm tra overdue payments
   * Processes overdue payments and applies penalties
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async processOverduePayments(): Promise<void> {
    try {
      this.logger.log('⚠️ Checking for overdue payments...');

      const now = vnNow();
      const overdueBookings = await this.bookingRepository.find({
        where: {
          status: BookingStatus.ACTIVE,
          firstRentDueAt: LessThanOrEqual(addDays(now, -3)), // 3 days overdue
          firstRentPaidAt: IsNull(), // Still unpaid
        },
        relations: ['tenant', 'property', 'contract'],
      });

      for (const booking of overdueBookings) {
        await this.processOverduePayment(booking);
      }

      this.logger.log(`⚠️ Processed ${overdueBookings.length} overdue payments`);
    } catch (error) {
      this.logger.error('❌ Error in overdue payment processing:', error);
    }
  }

  /**
   * Gửi payment reminder cho booking cụ thể
   */
  private async sendPaymentReminder(booking: Booking, daysToDue: number): Promise<void> {
    try {
      const messages = {
        7: {
          title: 'Nhắc nhở thanh toán (7 ngày)',
          content: `Bạn cần thanh toán tiền thuê đầu tiên cho căn hộ ${booking.property.title} trước ngày ${formatVN(booking.firstRentDueAt!, 'dd/MM/yyyy')}. Còn lại ${daysToDue} ngày.`
        },
        3: {
          title: 'Nhắc nhở thanh toán (3 ngày)',  
          content: `Chỉ còn ${daysToDue} ngày để thanh toán tiền thuê đầu tiên cho căn hộ ${booking.property.title}. Hãy thanh toán sớm để tránh phí phạt.`
        },
        1: {
          title: 'Nhắc nhở thanh toán (1 ngày)',
          content: `Ngày mai là hạn cuối thanh toán tiền thuê cho căn hộ ${booking.property.title}. Vui lòng thanh toán ngay để tránh bị phạt.`
        }
      };

      const message = messages[daysToDue as keyof typeof messages];
      if (!message) return;

      await this.notificationService.create({
        userId: booking.tenant.id,
        type: NotificationTypeEnum.PAYMENT,
        title: message.title,
        content: message.content,
      });

      this.logger.log(`📨 Sent ${daysToDue}-day payment reminder for booking ${booking.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send payment reminder for booking ${booking.id}:`, error);
    }
  }

  /**
   * Gửi deposit reminders
   */
  private async sendDepositReminders(): Promise<void> {
    const now = vnNow();
    
    const pendingDeposits = await this.bookingRepository.find({
      where: {
        status: BookingStatus.AWAITING_DEPOSIT,
        escrowDepositFundedAt: IsNull(),
        escrowDepositDueAt: MoreThan(now),
      },
      relations: ['tenant', 'property'],
    });

    for (const booking of pendingDeposits) {
      if (!booking.escrowDepositDueAt) continue;

      const hoursToDeadline = Math.ceil(
        (booking.escrowDepositDueAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      // Send reminder 12 hours before deadline
      if (hoursToDeadline <= 12 && hoursToDeadline > 0) {
        await this.notificationService.create({
          userId: booking.tenant.id,
          type: NotificationTypeEnum.PAYMENT,
          title: 'Nhắc nhở nộp tiền cọc',
          content: `Bạn cần nộp tiền cọc cho căn hộ ${booking.property.title} trong vòng ${hoursToDeadline} giờ tới để hoàn tất booking.`,
        });

        this.logger.log(`💰 Sent deposit reminder for booking ${booking.id}`);
      }
    }
  }

  /**
   * Xử lý overdue payment
   */
  private async processOverduePayment(booking: Booking): Promise<void> {
    try {
      if (!booking.firstRentDueAt || !booking.contractId) {
        this.logger.warn(`Skipping overdue processing for booking ${booking.id}: missing required fields`);
        return;
      }

      const daysPastDue = Math.floor(
        (vnNow().getTime() - booking.firstRentDueAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      this.logger.log(`Processing overdue payment for booking ${booking.id}, ${daysPastDue} days past due`);

      // Apply penalty through automated penalty service
      const penaltyResult = await this.automatedPenaltyService.applyPaymentOverduePenalty(
        booking,
        daysPastDue
      );

      if (penaltyResult) {
        this.logger.log(`⚠️ Applied penalty for overdue payment: booking ${booking.id}, amount: ${penaltyResult.penaltyAmount}`);
      } else {
        this.logger.warn(`❌ Failed to apply penalty for booking ${booking.id}`);
      }

    } catch (error) {
      this.logger.error(`❌ Failed to process overdue payment for booking ${booking.id}:`, error);
    }
  }

  /**
   * Cancel bookings where deposit is more than 24 hours overdue
   */
  private async cancelOverdueDeposits(): Promise<void> {
    try {
      const now = vnNow();
      
      // Find bookings awaiting deposit that are more than 24 hours overdue
      const overdueDeposits = await this.bookingRepository.find({
        where: {
          status: BookingStatus.AWAITING_DEPOSIT,
          escrowDepositFundedAt: IsNull(),
          escrowDepositDueAt: LessThanOrEqual(addDays(now, -1)), // 24+ hours overdue
        },
        relations: ['tenant', 'property', 'property.landlord'],
      });

      for (const booking of overdueDeposits) {
        try {
          const result = await this.automatedPenaltyService.cancelBookingForLateDeposit(booking);
          
          if (result?.cancelled) {
            this.logger.log(`🚫 Cancelled booking ${booking.id} for late deposit: ${result.reason}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to cancel booking ${booking.id} for late deposit:`, error);
        }
      }

      if (overdueDeposits.length > 0) {
        this.logger.log(`📋 Processed ${overdueDeposits.length} overdue deposit bookings`);
      }

    } catch (error) {
      this.logger.error('❌ Error in cancelOverdueDeposits:', error);
    }
  }
}