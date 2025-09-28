import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Services
import { BlockchainService } from './blockchain.service';
import { BlockchainConfigService } from './blockchain-config.service';
import { BlockchainEventService } from './blockchain-event.service';
import { BlockchainEventHandlerService } from './blockchain-event-handler.service';

// Controllers
import { ContractsController } from './contracts.controller';
import { PaymentsController } from './payments.controller';
import { BlockchainUtilityController } from './blockchain-utility.controller';
import { BlockchainEventsController } from './blockchain-events.controller';

// Guards
import { BlockchainAuthGuard } from './guards/blockchain-auth.guard';
import { JwtBlockchainAuthGuard } from './guards/jwt-blockchain-auth.guard';

// Import Auth Module for JWT
import { AuthModule } from '../core/auth/auth.module';

/**
 * Blockchain Module
 * Main module for Hyperledger Fabric blockchain integration
 */
@Module({
  imports: [
    ConfigModule, // For environment variable access
    PassportModule, // For JWT AuthGuard  
    forwardRef(() => AuthModule) // For JWT authentication
  ],
  providers: [
    BlockchainService,
    BlockchainConfigService,
    BlockchainEventService,
    BlockchainEventHandlerService,
    BlockchainAuthGuard,
    JwtBlockchainAuthGuard
  ],
  controllers: [
    ContractsController,
    PaymentsController,
    BlockchainUtilityController,
    BlockchainEventsController
  ],
  exports: [
    BlockchainService,
    BlockchainConfigService,
    BlockchainEventService,
    BlockchainEventHandlerService
  ]
})
export class BlockchainModule {}
