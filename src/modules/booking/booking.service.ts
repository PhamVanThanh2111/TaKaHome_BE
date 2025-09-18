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
    b.landlordEscrowDepositDueAt = new Date(
      Date.now() + depositDeadlineHours * 60 * 60 * 1000,
    );
    b.firstRentDueAt = new Date(
      Date.now() + depositDeadlineHours * 3 * 60 * 60 * 1000,
    );
    return this.bookingRepository.save(b);
  }

  // Gọi khi IPN cọc Người thuê thành công
  async markTenantDepositFunded(id: string) {
    const b = await this.findOne(id);
    if (b.escrowDepositFundedAt) {
      return b;
    }
    this.ensureStatus(b, [BookingStatus.AWAITING_DEPOSIT]);
    b.escrowDepositFundedAt = new Date();
    this.maybeMarkDualEscrowFunded(b);
    return this.bookingRepository.save(b);
  }

  // Gọi khi IPN ký quỹ Chủ nhà thành công
  async markLandlordDepositFunded(id: string) {
    const b = await this.findOne(id);
    if (b.landlordEscrowDepositFundedAt) {
      return b;
    }
    this.ensureStatus(b, [BookingStatus.AWAITING_DEPOSIT]);
    b.landlordEscrowDepositFundedAt = new Date();
    this.maybeMarkDualEscrowFunded(b);
    return this.bookingRepository.save(b);
  }

  // Alias cũ giữ nguyên API
  async markDepositFunded(id: string) {
    return this.markTenantDepositFunded(id);
  }

  // Gọi khi thanh toán kỳ đầu thành công (IPN hoặc ví)
  async markFirstRentPaid(id: string) {
    const b = await this.findOne(id);
    if (b.firstRentPaidAt) {
      return b;
    }
    this.ensureStatus(b, [
      BookingStatus.DUAL_ESCROW_FUNDED,
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

  async cancelOverdueDeposits(now = new Date()) {
    const bookings = await this.bookingRepository.find({
      where: { status: BookingStatus.AWAITING_DEPOSIT },
    });
    for (const b of bookings) {
      const tenantLate =
        !b.escrowDepositFundedAt &&
        b.escrowDepositDueAt &&
        b.escrowDepositDueAt < now;
      const landlordLate =
        !b.landlordEscrowDepositFundedAt &&
        b.landlordEscrowDepositDueAt &&
        b.landlordEscrowDepositDueAt < now;
      if (tenantLate || landlordLate) {
        b.status = BookingStatus.CANCELLED;
        await this.bookingRepository.save(b);
      }
    }
  }

  private maybeMarkDualEscrowFunded(b: Booking) {
    if (b.escrowDepositFundedAt && b.landlordEscrowDepositFundedAt) {
      b.status = BookingStatus.DUAL_ESCROW_FUNDED;
      if (!b.firstRentDueAt) {
        b.firstRentDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }
    }
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
      relations: ['tenant', 'property'],
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({ relations: ['tenant', 'property'] });
  }

  /**
   * Helper cho các service khác (Payment/IPN) đánh dấu mốc theo tenant + property
   */
  async markTenantDepositFundedByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ) {
    const booking = await this.findLatestByTenantAndProperty(
      tenantId,
      propertyId,
    );
    if (!booking)
      throw new NotFoundException('Booking not found for tenant/property');
    return this.markTenantDepositFunded(booking.id);
  }

  async markLandlordDepositFundedByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ) {
    const booking = await this.findLatestByTenantAndProperty(
      tenantId,
      propertyId,
    );
    if (!booking)
      throw new NotFoundException('Booking not found for tenant/property');
    return this.markLandlordDepositFunded(booking.id);
  }

  async markFirstRentPaidByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ) {
    const booking = await this.findLatestByTenantAndProperty(
      tenantId,
      propertyId,
    );
    if (!booking)
      throw new NotFoundException('Booking not found for tenant/property');
    return this.markFirstRentPaid(booking.id);
  }

  private async findLatestByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ) {
    const [booking] = await this.bookingRepository.find({
      where: {
        tenant: { id: tenantId },
        property: { id: propertyId },
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return booking ?? null;
  }
}
