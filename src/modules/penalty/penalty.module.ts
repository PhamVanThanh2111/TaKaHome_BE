import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AutomatedPenaltyService } from './automated-penalty.service';
import { Booking } from '../booking/entities/booking.entity';
import { Contract } from '../contract/entities/contract.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { NotificationModule } from '../notification/notification.module';
import { EscrowModule } from '../escrow/escrow.module';
import { ContractModule } from '../contract/contract.module';
import { PenaltyRecord } from './entities/penalty-record.entity';
import { Invoice } from '../invoice/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Contract, PenaltyRecord, Invoice]),
    forwardRef(() => BlockchainModule),
    forwardRef(() => ContractModule),
    NotificationModule,
    EscrowModule,
  ],
  providers: [AutomatedPenaltyService],
  exports: [AutomatedPenaltyService],
})
export class PenaltyModule {}
