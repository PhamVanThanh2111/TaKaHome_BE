import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking-cron.service';
import { ContractModule } from '../contract/contract.module';
import { SmartCAModule } from '../smartca/smartca.module';
import { S3StorageModule } from '../s3-storage/s3-storage.module';
import { Contract } from '../contract/entities/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Contract]),
    ContractModule,
    SmartCAModule,
    S3StorageModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingCronService],
  exports: [BookingService, TypeOrmModule],
})
export class BookingModule {}
