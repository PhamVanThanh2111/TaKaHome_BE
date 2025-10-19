import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { formatVN, vnNow } from '../common/datetime';
import { ContractStatusEnum } from '../modules/common/enums/contract-status.enum';
import { NotificationTypeEnum } from '../modules/common/enums/notification-type.enum';
import { Contract } from '../modules/contract/entities/contract.entity';
import { NotificationService } from '../modules/notification/notification.service';

/**
 * Contract Management Cron Jobs
 * Handles contract expiry reminders and maintenance scheduling
 */
@Injectable()
export class ContractManagementCron {
  private readonly logger = new Logger(ContractManagementCron.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private notificationService: NotificationService,
  ) {}

  /**
   * Chạy hàng ngày lúc 9h sáng để kiểm tra contract expiry
   * Sends contract expiry reminders at 30, 14, 7, 1 days before expiry
   */
  @Cron('0 9 * * *') // 9:00 AM every day
  async checkContractExpiry(): Promise<void> {
    try {
      this.logger.log('📋 Checking contracts for expiry reminders...');

      const now = vnNow();

      // Find active contracts
      const activeContracts = await this.contractRepository.find({
        where: {
          status: ContractStatusEnum.ACTIVE,
          endDate: MoreThan(now),
        },
        relations: ['tenant', 'landlord', 'property'],
      });

      for (const contract of activeContracts) {
        const daysToExpiry = Math.ceil(
          (contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Send reminders at specific intervals
        if ([30, 14, 7, 1].includes(daysToExpiry)) {
          await this.sendContractExpiryReminder(contract, daysToExpiry);
        }
      }

      this.logger.log(`📋 Checked ${activeContracts.length} active contracts`);
    } catch (error) {
      this.logger.error('❌ Error in contract expiry check:', error);
    }
  }

  /**
   * Gửi contract expiry reminder
   */
  private async sendContractExpiryReminder(
    contract: Contract,
    daysToExpiry: number,
  ): Promise<void> {
    try {
      const expiryDate = formatVN(contract.endDate, 'dd/MM/yyyy');

      const messages = {
        30: {
          title: 'Hợp đồng sắp hết hạn (1 tháng)',
          content: `Hợp đồng thuê căn hộ ${contract.property.title} sẽ hết hạn vào ${expiryDate}. Bạn có muốn gia hạn hợp đồng không? Vui lòng liên hệ để thảo luận điều khoản mới.`,
        },
        14: {
          title: 'Hợp đồng sắp hết hạn (2 tuần)',
          content: `Hợp đồng thuê căn hộ ${contract.property.title} sẽ hết hạn vào ${expiryDate}. Chỉ còn 2 tuần để chuẩn bị gia hạn hoặc chuyển nhà.`,
        },
        7: {
          title: 'Hợp đồng sắp hết hạn (1 tuần)',
          content: `Hợp đồng thuê căn hộ ${contract.property.title} sẽ hết hạn vào ${expiryDate}. Chỉ còn 1 tuần! Hãy liên hệ ngay để hoàn tất thủ tục.`,
        },
        1: {
          title: 'Hợp đồng hết hạn ngày mai',
          content: `Hợp đồng thuê căn hộ ${contract.property.title} sẽ hết hạn vào ngày mai (${expiryDate}). Vui lòng chuẩn bị bàn giao nhà hoặc hoàn tất thủ tục gia hạn.`,
        },
      };

      const message = messages[daysToExpiry as keyof typeof messages];
      if (!message) return;

      // Send to tenant
      await this.notificationService.create({
        userId: contract.tenant.id,
        type: NotificationTypeEnum.CONTRACT,
        title: message.title,
        content: message.content,
      });

      // Send to landlord
      await this.notificationService.create({
        userId: contract.landlord.id,
        type: NotificationTypeEnum.CONTRACT,
        title: message.title,
        content: `Hợp đồng thuê với người thuê ${contract.tenant.fullName} cho căn hộ ${contract.property.title} ${message.content.toLowerCase()}`,
      });

      this.logger.log(
        `📨 Sent ${daysToExpiry}-day contract expiry reminder for contract ${contract.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send contract expiry reminder for contract ${contract.id}:`,
        error,
      );
    }
  }

  // /**
  //  * Chạy cuối tháng để tạo maintenance reminders
  //  */
  // @Cron('0 10 28-31 * *') // 10:00 AM on 28-31st of each month
  // async scheduleMaintenanceReminders(): Promise<void> {
  //   try {
  //     this.logger.log('🔧 Scheduling monthly maintenance reminders...');

  //     const activeContracts = await this.contractRepository.find({
  //       where: {
  //         status: ContractStatusEnum.ACTIVE,
  //       },
  //       relations: ['tenant', 'landlord', 'property'],
  //     });

  //     for (const contract of activeContracts) {
  //       // Send maintenance reminder to tenant
  //       await this.notificationService.create({
  //         userId: contract.tenant.id,
  //         type: NotificationTypeEnum.GENERAL,
  //         title: '🔧 Nhắc nhở bảo trì định kỳ',
  //         content: `Đã đến thời gian kiểm tra và bảo trì căn hộ ${contract.property.title}. Vui lòng kiểm tra các thiết bị điện, nước, và báo cáo nếu có vấn đề.`,
  //       });

  //       // Send to landlord
  //       await this.notificationService.create({
  //         userId: contract.landlord.id,
  //         type: NotificationTypeEnum.GENERAL,
  //         title: '🔧 Lịch bảo trì định kỳ',
  //         content: `Thời gian kiểm tra bảo trì căn hộ ${contract.property.title}. Hãy liên hệ với người thuê để sắp xếp lịch kiểm tra.`,
  //       });
  //     }

  //     this.logger.log(
  //       `🔧 Sent maintenance reminders for ${activeContracts.length} active contracts`,
  //     );
  //   } catch (error) {
  //     this.logger.error('❌ Error in maintenance reminder scheduling:', error);
  //   }
  // }
}
