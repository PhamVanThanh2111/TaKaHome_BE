import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async landlordApprove(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.PENDING_LANDLORD]);
    b.status = BookingStatus.PENDING_SIGNATURE;
    return this.bookingRepository.save(b);
  }

  async landlordReject(id: string) {
    const b = await this.findOne(id);
    if (
      b.status === BookingStatus.CANCELLED ||
      b.status === BookingStatus.REJECTED
    )
      return b;
    b.status = BookingStatus.REJECTED;
    return this.bookingRepository.save(b);
  }

  // --- Helpers ---
  private ensureStatus(b: Booking, expected: BookingStatus[]) {
    if (!expected.includes(b.status)) {
      throw new BadRequestException(
        `Invalid state: ${b.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  async findOne(id: string) {
    const b = await this.bookingRepository.findOne({
      where: { id },
      relations: ['tenant', 'landlord', 'property'],
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({ relations: ['tenant', 'property'] });
  }
}
