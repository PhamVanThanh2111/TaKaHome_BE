import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, EscrowTransaction, Contract, Payment]),
    WalletModule,
  ],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
