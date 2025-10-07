import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AutomatedPenaltyService } from './automated-penalty.service';
import { Booking } from '../booking/entities/booking.entity';
import { Contract } from '../contract/entities/contract.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { NotificationModule } from '../notification/notification.module';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Contract]),
    forwardRef(() => BlockchainModule),
    NotificationModule,
    EscrowModule,
  ],
  providers: [AutomatedPenaltyService],
  exports: [AutomatedPenaltyService],
})
export class PenaltyModule {}