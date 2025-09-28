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
import { PropertyImageModule } from './modules/property-image/property-image.module';
import { PropertyUtilityModule } from './modules/property-utility/property-utility.module';
import { ChatRoomModule } from './modules/chatroom/chatroom.module';
import { ChatMessageModule } from './modules/chatmessage/chatmessage.module';
import { AuthModule } from './modules/core/auth/auth.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { SmartCAModule } from './modules/smartca/smartca.module';
import AppDataSourcePromise from './modules/core/database/data-source';

import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import vnpayConfig from './config/vnpay.config';
import smartcaConfig from './config/smartca.config';
import { WalletModule } from './modules/wallet/wallet.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { CronModule } from './cron/cron.module';
import { PenaltyModule } from './modules/penalty/penalty.module';
import { AutomationModule } from './modules/automation/automation.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => (await AppDataSourcePromise).options,
    }),
    ConfigModule.forRoot({
      isGlobal: true, // <— để dùng ở mọi nơi mà không cần import lại
      load: [vnpayConfig, smartcaConfig], // <— nạp file config/vnpay.config.ts
      validationSchema: Joi.object({
        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),
        // SmartCA validation (optional in case not configured)
        SMARTCA_SP_ID: Joi.string().optional(),
        SMARTCA_SP_PASSWORD: Joi.string().optional(),
        SMARTCA_ENVIRONMENT: Joi.string().valid('production', 'uat').default('production'),
      }),
    }),
    AuthModule,
    BlockchainModule,
    SmartCAModule,
    UserModule,
    PropertyModule,
    ContractModule,
    BookingModule,
    PaymentModule,
    ReviewModule,
    ReportModule,
    FavoriteModule,
    NotificationModule,
    AdminActionModule,
    VerificationModule,
    PropertyImageModule,
    PropertyUtilityModule,
    ChatRoomModule,
    ChatMessageModule,
    WalletModule,
    EscrowModule,
    InvoiceModule,
    MaintenanceModule,
    CronModule,
    PenaltyModule,
    AutomationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
