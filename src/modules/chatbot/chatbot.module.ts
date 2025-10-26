import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CustomThrottlerGuard } from './guards/custom-throttler.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [ChatbotService],
})
export class ChatbotModule {}
