import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking-cron.service';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), ContractModule],
  controllers: [BookingController],
  providers: [BookingService, BookingCronService],
  exports: [BookingService, TypeOrmModule],
})
export class BookingModule {}
