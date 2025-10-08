import { Module } from '@nestjs/common';
import { AutomationEventLoggingService } from './automation-event-logging.service';
import { AutomationController } from './automation.controller';
import { PenaltyModule } from '../penalty/penalty.module';

@Module({
  imports: [PenaltyModule],
  providers: [AutomationEventLoggingService],
  controllers: [AutomationController],
  exports: [AutomationEventLoggingService],
})
export class AutomationModule {}