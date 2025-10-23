import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { WalletModule } from '../wallet/wallet.module';
import { EscrowModule } from '../escrow/escrow.module';
import { BookingModule } from '../booking/booking.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ContractModule } from '../contract/contract.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Invoice, Escrow]),
    WalletModule,
    EscrowModule,
    BookingModule,
    BlockchainModule,
    ContractModule,
    UserModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService, TypeOrmModule],
})
export class PaymentModule {}
