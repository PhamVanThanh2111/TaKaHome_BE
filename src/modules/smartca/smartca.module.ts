import { Module } from '@nestjs/common';
import { SmartCAService } from './smartca.service';
import { SmartCAController } from './smartca.controller';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [ContractModule],
  providers: [SmartCAService],
  controllers: [SmartCAController],
  exports: [SmartCAService],
})
export class SmartCAModule {}
