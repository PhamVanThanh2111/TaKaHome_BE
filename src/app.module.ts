import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Import all module classes
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PropertyModule } from './modules/property/property.module';
import { ContractModule } from './modules/contract/contract.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { ReportModule } from './modules/report/report.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { MessageModule } from './modules/message/message.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminActionModule } from './modules/admin-action/admin-action.module';
import { VerificationModule } from './modules/verification/verification.module';
import { PropertyImageModule } from './modules/property-image/property-image.module';
import { PropertyUtilityModule } from './modules/property-utility/property-utility.module';
import { ChatRoomModule } from './modules/chatroom/chatroom.module';
import { ChatMessageModule } from './modules/chatmessage/chatmessage.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', // or mysql, etc.
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'password',
      database: process.env.DB_NAME || 'realestate',
      autoLoadEntities: true,
      synchronize: true, // OFF on production!
    }),
    UserModule,
    RoleModule,
    PropertyModule,
    ContractModule,
    BookingModule,
    PaymentModule,
    ReviewModule,
    ReportModule,
    FavoriteModule,
    MessageModule,
    NotificationModule,
    AdminActionModule,
    VerificationModule,
    PropertyImageModule,
    PropertyUtilityModule,
    ChatRoomModule,
    ChatMessageModule,
  ],
})
export class AppModule {}
