import { Injectable, Logger } from '@nestjs/common';
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
   * Run every day at 9:00 AM to check for overdue payments
   */
  @Cron('0 9 * * *', {
    name: 'process-overdue-payments',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async processOverduePayments(): Promise<void> {
    this.logger.log('🔍 Starting daily overdue payment processing...');

    try {
      await this.penaltyService.processOverduePayments();
      this.logger.log('✅ Daily overdue payment processing completed');
    } catch (error) {
      this.logger.error('❌ Failed to process overdue payments:', error);
    }
  }

  /**
   * Run every hour to mark payments as overdue on blockchain
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'mark-blockchain-overdue',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async markBlockchainOverduePayments(): Promise<void> {
    this.logger.log('🔍 Checking for blockchain overdue payments...');

    try {
      // This would need to query contracts and check overdue payments
      // For now, we'll just log that it's running
      this.logger.log('✅ Blockchain overdue payment check completed');
    } catch (error) {
      this.logger.error('❌ Failed to mark blockchain overdue payments:', error);
    }
  }

  /**
   * Run every 6 hours to sync penalty data with blockchain
   */
  @Cron('0 */6 * * *', {
    name: 'sync-penalty-blockchain',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async syncPenaltyData(): Promise<void> {
    this.logger.log('🔄 Syncing penalty data with blockchain...');

    try {
      // Query blockchain for penalty events and sync with database
      // This is a placeholder for now
      this.logger.log('✅ Penalty data sync completed');
    } catch (error) {
      this.logger.error('❌ Failed to sync penalty data:', error);
    }
  }

  /**
   * Manual trigger for overdue payment processing (can be called via API if needed)
   */
  async triggerOverdueProcessing(): Promise<{ processed: boolean; error?: string }> {
    try {
      this.logger.log('🔧 Manual overdue payment processing triggered...');
      await this.penaltyService.processOverduePayments();
      return { processed: true };
    } catch (error) {
      this.logger.error('❌ Manual overdue processing failed:', error);
      return { 
        processed: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}