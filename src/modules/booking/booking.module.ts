import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService, TypeOrmModule],
})
export class BookingModule {}
