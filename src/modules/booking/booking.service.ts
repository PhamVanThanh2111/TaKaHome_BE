import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async create(dto: CreateBookingDto) {
    const b = this.bookingRepository.create({
      tenant: { id: dto.tenantId },
      property: { id: dto.propertyId },
      status: BookingStatus.PENDING_LANDLORD,
      firstRentDueAt: dto.firstRentDueAt
        ? new Date(dto.firstRentDueAt)
        : undefined,
    });
    return this.bookingRepository.save(b);
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({ relations: ['tenant', 'property'] });
  }

  async findOne(id: number): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: id.toString() },
      relations: ['tenant', 'property'],
    });
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    return booking;
  }

  async update(
    id: number,
    updateBookingDto: UpdateBookingDto,
  ): Promise<Booking> {
    await this.bookingRepository.update(id, updateBookingDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.bookingRepository.delete(id);
  }
}
