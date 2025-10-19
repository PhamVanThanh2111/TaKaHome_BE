import { Module } from '@nestjs/common';
import { SmartCAService } from './smartca.service';
import { SmartCAController } from './smartca.controller';

@Module({
  imports: [],
  providers: [SmartCAService],
  controllers: [SmartCAController],
  exports: [SmartCAService],
})
export class SmartCAModule {}
