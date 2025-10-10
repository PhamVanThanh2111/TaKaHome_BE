import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { set } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { Contract } from '../contract/entities/contract.entity';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { InvoiceService } from './invoice.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    private readonly invoiceService: InvoiceService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * Generate monthly invoices from blockchain every day at 8:00 AM Vietnam time
   */
  @Cron('0 8 * * *', {
    name: 'generate-monthly-invoices-morning',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleGenerateMonthlyInvoicesMorning(): Promise<void> {
    try {
      this.logger.log('🌅 Starting morning invoice generation from blockchain...');
      await this.generateMonthlyFromBlockchain();
      this.logger.log('✅ Morning invoice generation completed successfully');
    } catch (error) {
      this.logger.error('❌ Error in morning invoice generation:', error);
    }
  }

  /**
   * Generate monthly invoices from blockchain every day at 6:00 PM Vietnam time (backup)
   */
  @Cron('0 18 * * *', {
    name: 'generate-monthly-invoices-evening',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleGenerateMonthlyInvoicesEvening(): Promise<void> {
    try {
      this.logger.log('🌆 Starting evening invoice generation from blockchain (backup)...');
      await this.generateMonthlyFromBlockchain();
      this.logger.log('✅ Evening invoice generation completed successfully');
    } catch (error) {
      this.logger.error('❌ Error in evening invoice generation:', error);
    }
  }

  /**
   * Generate monthly invoices based on blockchain payment schedule
   * Instead of checking for first day of month, we query blockchain for SCHEDULED payments
   */
  async generateMonthlyFromBlockchain(): Promise<ResponseCommon<null>> {
    try {
      this.logger.log('🔍 Checking blockchain for scheduled payments to create invoices...');

      // Create system user for blockchain queries
      const systemUser = {
        userId: 'system',
        orgName: 'OrgProp',
        mspId: 'OrgPropMSP',
      };

      // Query SCHEDULED payments from blockchain
      const scheduledResponse = await this.blockchainService.queryPaymentsByStatus('SCHEDULED', systemUser);
      
      if (!scheduledResponse.success || !scheduledResponse.data) {
        this.logger.warn('No scheduled payments found or blockchain query failed');
        return new ResponseCommon(200, 'NO_SCHEDULED_PAYMENTS', null);
      }

      const scheduledPayments = scheduledResponse.data;
      const todayUtc = vnNow();
      let invoicesCreated = 0;

      for (const payment of scheduledPayments) {
        try {
          // Check if payment is due today or overdue
          if (!payment.dueDate) {
            this.logger.warn(`Payment ${payment.paymentId} has no due date`);
            continue;
          }
          
          const dueDate = new Date(payment.dueDate);
          const daysDiff = Math.ceil((dueDate.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));
          
          // Create invoice for payments due in 7 days or less (early notification)
          // or payments that are already due/overdue
          if (daysDiff <= 7) {
            // Find the contract in our database
            const contract = await this.contractRepo.findOne({
              where: { contractCode: payment.contractId },
              relations: ['property'],
            });

            if (!contract) {
              this.logger.warn(`Contract not found for contractId: ${payment.contractId}`);
              continue;
            }

            // Check if invoice already exists for this period
            const existingInvoices = await this.invoiceService.findByContract(contract.id);
            const period = `${payment.period}`;
            const invoiceExists = existingInvoices.data?.some(invoice => 
              invoice.items?.some(item => item.description.includes(period))
            );

            if (invoiceExists) {
              this.logger.log(`Invoice already exists for contract ${contract.contractCode} period ${period}`);
              continue;
            }

            // Create invoice based on blockchain payment schedule
            await this.invoiceService.create({
              contractId: contract.id,
              dueDate: formatVN(dueDate, 'yyyy-MM-dd'),
              items: [
                {
                  description: `Monthly rent - Period ${period}`,
                  amount: payment.amount,
                },
              ],
            });

            invoicesCreated++;
            this.logger.log(`✅ Created invoice for contract ${contract.contractCode}, period ${period}, amount ${payment.amount}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to process payment for contract ${payment.contractId}:`, error);
        }
      }

      this.logger.log(`🎯 Invoice generation completed. Created ${invoicesCreated} invoices from ${scheduledPayments.length} scheduled payments`);
      return new ResponseCommon(200, 'SUCCESS', null);

    } catch (error) {
      this.logger.error('❌ Failed to generate monthly invoices from blockchain:', error);
      return new ResponseCommon(500, 'BLOCKCHAIN_ERROR', null);
    }
  }

  /**
   * Legacy method - kept for backwards compatibility
   * @deprecated Use generateMonthlyFromBlockchain instead
   */
  async generateMonthly(): Promise<ResponseCommon<null>> {
    this.logger.warn('⚠️ generateMonthly() is deprecated. Use generateMonthlyFromBlockchain() instead');
    return this.generateMonthlyFromBlockchain();
  }
}
