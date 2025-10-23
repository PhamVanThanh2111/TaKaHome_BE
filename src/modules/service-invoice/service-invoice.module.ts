import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServiceInvoiceService } from './service-invoice.service';
import { ServiceInvoiceController } from './service-invoice.controller';
import { ServiceInvoice } from './entities/service-invoice.entity';
import { Contract } from '../contract/entities/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceInvoice, Contract]),
    ConfigModule,
  ],
  controllers: [ServiceInvoiceController],
  providers: [ServiceInvoiceService],
  exports: [ServiceInvoiceService],
})
export class ServiceInvoiceModule {}