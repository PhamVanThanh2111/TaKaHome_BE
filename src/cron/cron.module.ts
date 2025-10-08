import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentReminderCron } from './payment-reminder.cron';
import { ContractManagementCron } from './contract-management.cron';
import { SystemMaintenanceCron } from './system-maintenance.cron';
import { AutomatedPenaltyCron } from './automated-penalty.cron';

import { BookingModule } from '../modules/booking/booking.module';
import { ContractModule } from '../modules/contract/contract.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { BlockchainModule } from '../modules/blockchain/blockchain.module';
import { PenaltyModule } from '../modules/penalty/penalty.module';
import { AutomationModule } from '../modules/automation/automation.module';

import { Booking } from '../modules/booking/entities/booking.entity';
import { Contract } from '../modules/contract/entities/contract.entity';
import { Notification } from '../modules/notification/entities/notification.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Booking, Contract, Notification]),
    BookingModule,
    ContractModule,
    NotificationModule,
    BlockchainModule,
    PenaltyModule,
    AutomationModule,
  ],
  providers: [
    PaymentReminderCron,
    ContractManagementCron,
    SystemMaintenanceCron,
    AutomatedPenaltyCron,
  ],
  exports: [
    PaymentReminderCron,
    ContractManagementCron,
    SystemMaintenanceCron,
    AutomatedPenaltyCron,
  ],
})
export class CronModule {}
