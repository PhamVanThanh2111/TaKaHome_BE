import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { S3StorageModule } from '../s3-storage/s3-storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract]), BlockchainModule, S3StorageModule],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService, TypeOrmModule],
})
export class ContractModule {}
