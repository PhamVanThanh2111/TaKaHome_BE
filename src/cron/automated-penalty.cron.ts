import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Cron, CronExpression } from '@nestjs/schedule';
import { AutomatedPenaltyService } from '../modules/penalty/automated-penalty.service';
import { BlockchainService } from '../modules/blockchain/blockchain.service';

/**
 * Automated Penalty Cron Service
 * Handles scheduled penalty applications and overdue payment processing
 */
@Injectable()
export class AutomatedPenaltyCron {
  private readonly logger = new Logger(AutomatedPenaltyCron.name);

  constructor(
    private readonly penaltyService: AutomatedPenaltyService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * Run every day at 9:00 AM to check for overdue payments firstmonth
   *
   * PRIMARY RESPONSIBILITY: Handle ALL overdue payment penalties
   * This is the single source of truth for overdue payment processing
   * to avoid duplicate penalty applications.
   */
  //Demo
  // @Cron('0 9 * * *', {
  //   name: 'process-overdue-payments',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  @Cron('*/11 * * * *', {
    name: 'process-overdue-payments',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async processOverduePayments(): Promise<void> {
    this.logger.log(
      '🔍 Starting daily overdue payment processing (SINGLE SOURCE OF TRUTH)...',
    );

    try {
      await this.penaltyService.processOverduePayments();
      this.logger.log('✅ Daily overdue payment processing completed');
    } catch (error) {
      this.logger.error('❌ Failed to process overdue payments:', error);
    }
  }

  /**
   * Run every day at 8:00 AM to check for overdue handovers (landlord penalties)
   */
  @Cron('0 8 * * *', {
    name: 'process-overdue-handovers',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async processOverdueHandovers(): Promise<void> {
    this.logger.log(
      '🏠 Starting daily handover deadline check (landlord penalties)...',
    );

    try {
      await this.penaltyService.processOverdueHandovers();
      this.logger.log('✅ Daily handover deadline processing completed');
    } catch (error) {
      this.logger.error('❌ Failed to process overdue handovers:', error);
    }
  }

  /**
   * Run every 5 minutes to check for pending signature timeouts (30 minute limit)
   */
  @Cron('*/5 * * * *', {
    name: 'process-pending-signature-timeouts',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async processPendingSignatureTimeouts(): Promise<void> {
    this.logger.log(
      '📝 Checking for pending signature timeouts (30 minute limit)...',
    );

    try {
      await this.penaltyService.processPendingSignatureTimeouts();
      this.logger.log('✅ Pending signature timeout processing completed');
    } catch (error) {
      this.logger.error(
        '❌ Failed to process pending signature timeouts:',
        error,
      );
    }
  }

  /**
   * Run every day at 10:00 AM to check for monthly payment overdue
   */
  @Cron('*/9 * * * *', {
    name: 'process-monthly-overdue-payments',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async processMonthlyOverduePayments(): Promise<void> {
    this.logger.log(
      '🔍 Starting monthly overdue payment processing every day at 10:00 AM',
    );

    try {
      const startTime = Date.now();
      await this.penaltyService.processMonthlyOverduePayments();
      const endTime = Date.now();
      this.logger.log(
        `✅ [TEST MODE] Monthly overdue payment processing completed in ${endTime - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ [TEST MODE] Failed to process monthly overdue payments:',
        error,
      );
      this.logger.error('Error stack:', error);
    }
  }

  /**
   * Run every hour to mark payments as overdue on blockchain
   */
  // @Cron(CronExpression.EVERY_HOUR, {
  //   name: 'mark-blockchain-overdue',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // markBlockchainOverduePayments(): void {
  //   this.logger.log('🔍 Checking for blockchain overdue payments...');

  //   try {
  //     // This would need to query contracts and check overdue payments
  //     // For now, we'll just log that it's running
  //     this.logger.log('✅ Blockchain overdue payment check completed');
  //   } catch (error) {
  //     this.logger.error(
  //       '❌ Failed to mark blockchain overdue payments:',
  //       error,
  //     );
  //   }
  // }

  // /**
  //  * Run every 6 hours to sync penalty data with blockchain
  //  */
  // @Cron('0 */6 * * *', {
  //   name: 'sync-penalty-blockchain',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // syncPenaltyData(): void {
  //   this.logger.log('🔄 Syncing penalty data with blockchain...');

  //   try {
  //     // Query blockchain for penalty events and sync with database
  //     // This is a placeholder for now
  //     this.logger.log('✅ Penalty data sync completed');
  //   } catch (error) {
  //     this.logger.error('❌ Failed to sync penalty data:', error);
  //   }
  // }

  /**
   * Manual trigger for overdue payment processing (can be called via API if needed)
   */
  async triggerOverdueProcessing(): Promise<{
    processed: boolean;
    error?: string;
  }> {
    try {
      this.logger.log('🔧 Manual overdue payment processing triggered...');
      await this.penaltyService.processOverduePayments();
      return { processed: true };
    } catch (error) {
      this.logger.error('❌ Manual overdue processing failed:', error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manual trigger for monthly overdue payment processing (can be called via API if needed)
   */
  async triggerMonthlyOverdueProcessing(): Promise<{
    processed: boolean;
    error?: string;
  }> {
    try {
      this.logger.log(
        '🔧 Manual monthly overdue payment processing triggered...',
      );
      await this.penaltyService.processMonthlyOverduePayments();
      return { processed: true };
    } catch (error) {
      this.logger.error('❌ Manual monthly overdue processing failed:', error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manual trigger for handover deadline processing (can be called via API if needed)
   */
  async triggerHandoverProcessing(): Promise<{
    processed: boolean;
    error?: string;
  }> {
    try {
      this.logger.log('🔧 Manual handover deadline processing triggered...');
      await this.penaltyService.processOverdueHandovers();
      return { processed: true };
    } catch (error) {
      this.logger.error('❌ Manual handover processing failed:', error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manual trigger for pending signature timeout processing (can be called via API if needed)
   */
  async triggerPendingSignatureProcessing(): Promise<{
    processed: boolean;
    error?: string;
  }> {
    try {
      this.logger.log('🔧 Manual pending signature processing triggered...');
      await this.penaltyService.processPendingSignatureTimeouts();
      return { processed: true };
    } catch (error) {
      this.logger.error(
        '❌ Manual pending signature processing failed:',
        error,
      );
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
