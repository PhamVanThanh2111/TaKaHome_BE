import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractExtension } from './entities/contract-extension.entity';
import { ContractService } from './contract.service';
import { ContractExtensionService } from './contract-extension.service';
import { ContractController } from './contract.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { S3StorageModule } from '../s3-storage/s3-storage.module';
import { ContractTerminationService } from './contract-termination.service';
import { DisputeHandlingService } from './dispute-handling.service';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { EscrowModule } from '../escrow/escrow.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';
import { SmartCAModule } from '../smartca/smartca.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractExtension, Booking, User]),
    BlockchainModule,
    S3StorageModule,
    SmartCAModule,
    EscrowModule,
    NotificationModule,
    WalletModule,
  ],
  controllers: [ContractController],
  providers: [
    ContractService,
    ContractExtensionService,
    ContractTerminationService,
    DisputeHandlingService,
  ],
  exports: [ContractService, TypeOrmModule],
})
export class ContractModule {}
