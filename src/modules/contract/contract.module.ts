import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract]), BlockchainModule],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService, TypeOrmModule],
})
export class ContractModule {}
