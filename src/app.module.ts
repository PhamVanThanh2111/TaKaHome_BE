/* eslint-disable prettier/prettier */
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

import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import vnpayConfig from './config/vnpay.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: process.env.DB_TYPE as 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT ?? '5432'),
        username: process.env.DB_USER || 'neondb_owner',
        password: process.env.DB_PASS,
        database: process.env.DB_NAME || 'rent_home',
        autoLoadEntities: true,
        synchronize: false, // OFF on production!
        ssl: { require: true, rejectUnauthorized: false },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true, // <— để dùng ở mọi nơi mà không cần import lại
      load: [vnpayConfig], // <— nạp file config/vnpay.config.ts
      validationSchema: Joi.object({
        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,             // <— để dùng ở mọi nơi mà không cần import lại
      load: [vnpayConfig],        // <— nạp file config/vnpay.config.ts
      validationSchema: Joi.object({
        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),
      }),
    }),
    AuthModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
