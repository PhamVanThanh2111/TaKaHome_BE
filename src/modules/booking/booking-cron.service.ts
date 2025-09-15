import { Injectable, OnModuleInit } from '@nestjs/common';
import { BookingService } from './booking.service';

@Injectable()
export class BookingCronService implements OnModuleInit {
  constructor(private readonly bookingService: BookingService) {}

  onModuleInit() {
    setInterval(
      () => {
        void this.bookingService.cancelOverdueDeposits();
      },
      60 * 60 * 1000,
    );
  }
}
