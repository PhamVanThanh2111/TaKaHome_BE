import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async tenantSign(id: string, depositDeadlineHours = 24) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.PENDING_SIGNATURE]);
    b.status = BookingStatus.AWAITING_DEPOSIT;
    b.signedAt = new Date();
    b.escrowDepositDueAt = new Date(
      Date.now() + depositDeadlineHours * 60 * 60 * 1000,
    );
    return this.bookingRepository.save(b);
  }

  // Gọi khi IPN cọc thành công (service thanh toán sẽ gọi sang)
  async markDepositFunded(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.AWAITING_DEPOSIT]);
    b.status = BookingStatus.DEPOSIT_FUNDED;
    b.escrowDepositFundedAt = new Date();
    // Option: nếu muốn ấn định hạn kỳ đầu tại đây
    if (!b.firstRentDueAt) {
      // hạn kỳ đầu = 3 ngày sau khi cọc xong
      b.firstRentDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    }
    return this.bookingRepository.save(b);
  }

  // Gọi khi thanh toán kỳ đầu thành công (IPN hoặc ví)
  async markFirstRentPaid(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [
      BookingStatus.DEPOSIT_FUNDED,
      BookingStatus.AWAITING_FIRST_RENT,
    ]);
    b.status = BookingStatus.READY_FOR_HANDOVER;
    b.firstRentPaidAt = new Date();
    return this.bookingRepository.save(b);
  }

  async handover(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.READY_FOR_HANDOVER]);
    b.status = BookingStatus.ACTIVE;
    b.handoverAt = new Date();
    b.activatedAt = new Date();
    return this.bookingRepository.save(b);
  }

  async startSettlement(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.ACTIVE]);
    b.status = BookingStatus.SETTLEMENT_PENDING;
    return this.bookingRepository.save(b);
  }

  async closeSettled(id: string) {
    const b = await this.findOne(id);
    this.ensureStatus(b, [BookingStatus.SETTLEMENT_PENDING]);
    b.status = BookingStatus.SETTLED;
    b.closedAt = new Date();
    return this.bookingRepository.save(b);
  }

  async updateMeta(id: string, dto: UpdateBookingDto) {
    const b = await this.findOne(id);
    if (dto.escrowDepositDueAt)
      b.escrowDepositDueAt = new Date(dto.escrowDepositDueAt);
    if (dto.firstRentDueAt) b.firstRentDueAt = new Date(dto.firstRentDueAt);
    if (dto.status) b.status = dto.status; // dùng thận trọng
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
