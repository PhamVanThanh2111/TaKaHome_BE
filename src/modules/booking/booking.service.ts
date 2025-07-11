import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const booking = this.bookingRepository.create(createBookingDto as any);
    return this.bookingRepository.save(booking);
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({ relations: ['tenant', 'property'] });
  }

  async findOne(id: number): Promise<Booking> {
    return this.bookingRepository.findOne({
      where: { id },
      relations: ['tenant', 'property'],
    });
  }

  async update(
    id: number,
    updateBookingDto: UpdateBookingDto,
  ): Promise<Booking> {
    await this.bookingRepository.update(id, updateBookingDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.bookingRepository.delete(id);
  }
}
