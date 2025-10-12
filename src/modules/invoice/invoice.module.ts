import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceCronService } from './invoice-cron.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { Contract } from '../contract/entities/contract.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Contract]),
    BlockchainModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceCronService],
  exports: [InvoiceService, InvoiceCronService, TypeOrmModule],
})
export class InvoiceModule {}
