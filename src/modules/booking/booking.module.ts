import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking-cron.service';
import { ContractModule } from '../contract/contract.module';
import { SmartCAModule } from '../smartca/smartca.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), ContractModule, SmartCAModule],
  controllers: [BookingController],
  providers: [BookingService, BookingCronService],
  exports: [BookingService, TypeOrmModule],
})
export class BookingModule {}
