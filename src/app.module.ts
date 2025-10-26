import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Import all module classes
import { UserModule } from './modules/user/user.module';
import { PropertyModule } from './modules/property/property.module';
import { ContractModule } from './modules/contract/contract.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { ReportModule } from './modules/report/report.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminActionModule } from './modules/admin-action/admin-action.module';
import { VerificationModule } from './modules/verification/verification.module';
import { ChatRoomModule } from './modules/chatroom/chatroom.module';
import { ChatMessageModule } from './modules/chatmessage/chatmessage.module';
import { ChatModule } from './modules/chat/chat.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { AuthModule } from './modules/core/auth/auth.module';
import AppDataSourcePromise from './modules/core/database/data-source';

import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import vnpayConfig from './config/vnpay.config';
import smartcaConfig from './config/smartca.config';
import frontendConfig from './config/frontend.config';
import { WalletModule } from './modules/wallet/wallet.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { SmartCAModule } from './modules/smartca/smartca.module';
import { CronModule } from './cron/cron.module';
import { StatisticsModule } from './modules/statistics/statistics.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => (await AppDataSourcePromise).options,
    }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true, // <— để dùng ở mọi nơi mà không cần import lại
      load: [vnpayConfig, smartcaConfig, frontendConfig], // <— nạp file config/vnpay.config.ts, smartca.config.ts và frontend.config.ts
      validationSchema: Joi.object({
        // Frontend validation
        FRONTEND_URL: Joi.string().required().uri(),

        // VNPAY validation
        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),

        // SmartCA validation (optional in case not configured)
        SMARTCA_BASE_URL: Joi.string().uri().optional(),
        SMARTCA_SIGN_PATH: Joi.string().optional(),
        SMARTCA_CERT_PATH: Joi.string().optional(),
        SMARTCA_SIGN_STATUS_TMPL: Joi.string().optional(),
        SMARTCA_SP_ID: Joi.string().optional(),
        SMARTCA_SP_PASSWORD: Joi.string().optional(),
        OID_DATA: Joi.string().optional(),
        OID_SIGNED_DATA: Joi.string().optional(),
        OID_CONTENT_TYPE: Joi.string().optional(),
        OID_MESSAGE_DIGEST: Joi.string().optional(),
        OID_SIGNING_TIME: Joi.string().optional(),
        OID_SIGNING_CERT_V2: Joi.string().optional(),

        // Gemini API validation
        GEMINI_API_KEY: Joi.string().optional(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 giây
        limit: 3, // 3 requests mỗi giây
      },
      {
        name: 'medium',
        ttl: 60000, // 1 phút
        limit: 20, // 20 requests mỗi phút
      },
      {
        name: 'long',
        ttl: 3600000, // 1 giờ
        limit: 100, // 100 requests mỗi giờ
      },
    ]),
    AuthModule,
    UserModule,
    PropertyModule,
    ContractModule,
    BookingModule,
    PaymentModule,
    SmartCAModule,
    ReviewModule,
    ReportModule,
    FavoriteModule,
    NotificationModule,
    AdminActionModule,
    VerificationModule,
    ChatRoomModule,
    ChatMessageModule,
    ChatModule,
    ChatbotModule,
    WalletModule,
    EscrowModule,
    InvoiceModule,
    CronModule,
    StatisticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
