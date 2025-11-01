import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { addDaysVN, vnNow } from '../common/datetime';
import { Booking } from '../modules/booking/entities/booking.entity';
import { StatusEnum } from '../modules/common/enums/status.enum';
import { Contract } from '../modules/contract/entities/contract.entity';
import { Notification } from '../modules/notification/entities/notification.entity';

/**
 * System Maintenance Cron Jobs
 * Handles cleanup tasks and system maintenance
 */
@Injectable()
export class SystemMaintenanceCron {
  private readonly logger = new Logger(SystemMaintenanceCron.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Chạy hàng ngày lúc 2h sáng để cleanup dữ liệu cũ
   * Daily cleanup of old data
   */
  @Cron('0 2 * * *') // 2:00 AM daily
  async dailyCleanup(): Promise<void> {
    try {
      this.logger.log('🧹 Starting daily system cleanup...');

      await this.cleanupOldNotifications();
      // await this.cleanupExpiredBookings();
      // await this.updateExpiredContracts();

      this.logger.log('✅ Daily cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error in daily cleanup:', error);
    }
  }

  /**
   * Chạy hàng tuần để cleanup dữ liệu cũ hơn
   * Weekly cleanup of older data
   */
  // @Cron('0 3 * * 0') // 3:00 AM every Sunday
  // async weeklyCleanup(): Promise<void> {
  //   try {
  //     this.logger.log('🗂️ Starting weekly system cleanup...');

  //     // Add more intensive cleanup tasks here
  //     await this.archiveOldBookings();
  //     // await this.cleanupOldLogs();

  //     this.logger.log('✅ Weekly cleanup completed');
  //   } catch (error) {
  //     this.logger.error('❌ Error in weekly cleanup:', error);
  //   }
  // }

  /**
   * Xóa notifications cũ hơn 30 ngày đã đọc
   */
  private async cleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = addDaysVN(vnNow(), -30);

    const result = await this.notificationRepository.delete({
      status: StatusEnum.COMPLETED, // Assuming read notifications are marked as COMPLETED
      createdAt: LessThan(thirtyDaysAgo), // Use createdAt instead
    });

    this.logger.log(`🗑️ Cleaned up ${result.affected || 0} old notifications`);
  }

  // /**
  //  * Cleanup các bookings đã expired và cancelled lâu
  //  */
  // private async cleanupExpiredBookings(): Promise<void> {
  //   const sevenDaysAgo = addDaysVN(vnNow(), -7);

  //   // Find bookings that are cancelled/rejected and older than 7 days
  //   const expiredBookings = await this.bookingRepository.find({
  //     where: [
  //       {
  //         status: BookingStatus.CANCELLED,
  //         updatedAt: LessThan(sevenDaysAgo),
  //       },
  //       {
  //         status: BookingStatus.REJECTED,
  //         updatedAt: LessThan(sevenDaysAgo),
  //       },
  //     ],
  //   });

  //   // You might want to archive these instead of deleting
  //   for (const booking of expiredBookings) {
  //     this.logger.log(`📦 Archiving expired booking ${booking.id}`);
  //     // Add archiving logic here if needed
  //   }

  //   this.logger.log(`📦 Processed ${expiredBookings.length} expired bookings`);
  // }

  /**
   * Cập nhật trạng thái contracts đã hết hạn
   */
  // private async updateExpiredContracts(): Promise<void> {
  //   const now = vnNow();

  //   const expiredContracts = await this.contractRepository.find({
  //     where: {
  //       status: ContractStatusEnum.ACTIVE,
  //       endDate: LessThan(now),
  //     },
  //   });

  //   for (const contract of expiredContracts) {
  //     contract.status = ContractStatusEnum.TERMINATED; // Use existing status
  //     await this.contractRepository.save(contract);

  //     this.logger.log(
  //       `⏰ Marked contract ${contract.id} as terminated (expired)`,
  //     );
  //   }

  //   this.logger.log(`⏰ Updated ${expiredContracts.length} expired contracts`);
  // }

  /**
   * Archive old bookings (older than 90 days and completed)
   */
  // private async archiveOldBookings(): Promise<void> {
  //   const ninetyDaysAgo = addDaysVN(vnNow(), -90);

  //   const oldBookings = await this.bookingRepository.find({
  //     where: [
  //       {
  //         status: BookingStatus.SETTLED,
  //         updatedAt: LessThan(ninetyDaysAgo),
  //       },
  //     ],
  //   });

  //   // Here you might want to move data to archive tables
  //   // or mark them as archived

  //   this.logger.log(
  //     `📚 Found ${oldBookings.length} bookings eligible for archiving`,
  //   );
  // }

  /**
   * Cleanup old system logs (if you have logging tables)
   */
  // private async cleanupOldLogs(): Promise<void> {
  //   // Implement if you have system log tables
  //   this.logger.log('🗂️ Log cleanup completed');
  // }

  /**
   * Health check method that can be called manually or via endpoint
   */
  //   async performHealthCheck(): Promise<{
  //     status: string;
  //     checks: Record<string, boolean>;
  //     timestamp: Date;
  //   }> {
  //     const checks = {
  //       database: true, // Add actual DB health check
  //       notifications: true, // Check notification system
  //       blockchain: true, // Check blockchain connection
  //     };

  //     // Implement actual health checks here

  //     const allHealthy = Object.values(checks).every((check) => check);

  //     return {
  //       status: allHealthy ? 'healthy' : 'unhealthy',
  //       checks,
  //       timestamp: vnNow(),
  //     };
  //   }
}
