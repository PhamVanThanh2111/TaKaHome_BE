import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { WalletModule } from '../wallet/wallet.module';
import { EscrowModule } from '../escrow/escrow.module';
import { BookingModule } from '../booking/booking.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Invoice]),
    WalletModule,
    EscrowModule,
    BookingModule,
    BlockchainModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService, TypeOrmModule],
})
export class PaymentModule {}
