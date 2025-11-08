import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractExtension } from './entities/contract-extension.entity';
import { ContractTerminationRequest } from './entities/contract-termination-request.entity';
import { ContractService } from './contract.service';
import { ContractExtensionService } from './contract-extension.service';
import { ContractTerminationRequestService } from './contract-termination-request.service';
import { ContractController } from './contract.controller';
import { ContractTerminationRequestController } from './contract-termination-request.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { S3StorageModule } from '../s3-storage/s3-storage.module';
import { ContractTerminationService } from './contract-termination.service';
import { DisputeHandlingService } from './dispute-handling.service';
import { PdfFillService } from './pdf-fill.service';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Property } from '../property/entities/property.entity';
import { Room } from '../property/entities/room.entity';
import { EscrowModule } from '../escrow/escrow.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';
import { SmartCAModule } from '../smartca/smartca.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractExtension,
      ContractTerminationRequest,
      Booking,
      User,
      Escrow,
      Property,
      Room, 
    ]),
    BlockchainModule,
    S3StorageModule,
    SmartCAModule,
    EscrowModule,
    NotificationModule,
    WalletModule,
  ],
  controllers: [ContractController, ContractTerminationRequestController],
  providers: [
    ContractService,
    ContractExtensionService,
    ContractTerminationRequestService,
    ContractTerminationService,
    DisputeHandlingService,
    PdfFillService,
  ],
  exports: [
    ContractService,
    ContractExtensionService,
    ContractTerminationRequestService,
    ContractTerminationService,
    PdfFillService,
    TypeOrmModule,
  ],
})
export class ContractModule {}