import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { BlockchainService } from './blockchain.service';
import { BlockchainConfigService } from './blockchain-config.service';

// Controllers
import { ContractsController } from './contracts.controller';
import { PaymentsController } from './payments.controller';
import { BlockchainUtilityController } from './blockchain-utility.controller';

// Guards
import { BlockchainAuthGuard } from './guards/blockchain-auth.guard';

/**
 * Blockchain Module
 * Main module for Hyperledger Fabric blockchain integration
 */
@Module({
  imports: [
    ConfigModule // For environment variable access
  ],
  providers: [
    BlockchainService,
    BlockchainConfigService,
    BlockchainAuthGuard
  ],
  controllers: [
    ContractsController,
    PaymentsController,
    BlockchainUtilityController
  ],
  exports: [
    BlockchainService,
    BlockchainConfigService
  ]
})
export class BlockchainModule {}
