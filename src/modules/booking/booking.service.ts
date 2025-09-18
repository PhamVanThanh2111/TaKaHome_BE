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
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async create(dto: CreateBookingDto): Promise<ResponseCommon<Booking>> {
    const booking = this.bookingRepository.create({
      tenant: { id: dto.tenantId },
      property: { id: dto.propertyId },
      status: BookingStatus.PENDING_LANDLORD,
      firstRentDueAt: dto.firstRentDueAt
        ? new Date(dto.firstRentDueAt)
        : undefined,
    });
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async landlordApprove(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_LANDLORD]);
    booking.status = BookingStatus.PENDING_SIGNATURE;
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async landlordReject(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    booking.status = BookingStatus.REJECTED;
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async tenantSign(
    id: string,
    depositDeadlineHours = 24,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_SIGNATURE]);
    booking.status = BookingStatus.AWAITING_DEPOSIT;
    booking.signedAt = new Date();
    booking.escrowDepositDueAt = new Date(
      Date.now() + depositDeadlineHours * 60 * 60 * 1000,
    );
    booking.landlordEscrowDepositDueAt = new Date(
      Date.now() + depositDeadlineHours * 60 * 60 * 1000,
    );
    booking.firstRentDueAt = new Date(
      Date.now() + depositDeadlineHours * 3 * 60 * 60 * 1000,
    );
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // Gọi khi IPN cọc Người thuê thành công
  async markTenantDepositFunded(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    if (booking.escrowDepositFundedAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [BookingStatus.AWAITING_DEPOSIT]);
    booking.escrowDepositFundedAt = new Date();
    this.maybeMarkDualEscrowFunded(booking);
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // Gọi khi IPN ký quỹ Chủ nhà thành công
  async markLandlordDepositFunded(
    id: string,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    if (booking.landlordEscrowDepositFundedAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [BookingStatus.AWAITING_DEPOSIT]);
    booking.landlordEscrowDepositFundedAt = new Date();
    this.maybeMarkDualEscrowFunded(booking);
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // Alias cũ giữ nguyên API
  async markDepositFunded(id: string): Promise<ResponseCommon<Booking>> {
    return this.markTenantDepositFunded(id);
  }

  // Gọi khi thanh toán kỳ đầu thành công (IPN hoặc ví)
  async markFirstRentPaid(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    if (booking.firstRentPaidAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [
      BookingStatus.DEPOSIT_FUNDED,
      BookingStatus.DUAL_ESCROW_FUNDED,
      BookingStatus.AWAITING_FIRST_RENT,
    ]);
    booking.status = BookingStatus.READY_FOR_HANDOVER;
    booking.firstRentPaidAt = new Date();
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async handover(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    this.ensureStatus(booking, [BookingStatus.READY_FOR_HANDOVER]);
    booking.status = BookingStatus.ACTIVE;
    booking.handoverAt = new Date();
    booking.activatedAt = new Date();
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async startSettlement(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    this.ensureStatus(booking, [BookingStatus.ACTIVE]);
    booking.status = BookingStatus.SETTLEMENT_PENDING;
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async closeSettled(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    this.ensureStatus(booking, [BookingStatus.SETTLEMENT_PENDING]);
    booking.status = BookingStatus.SETTLED;
    booking.closedAt = new Date();
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async updateMeta(
    id: string,
    dto: UpdateBookingDto,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    if (dto.escrowDepositDueAt)
      booking.escrowDepositDueAt = new Date(dto.escrowDepositDueAt);
    if (dto.firstRentDueAt)
      booking.firstRentDueAt = new Date(dto.firstRentDueAt);
    if (dto.status) booking.status = dto.status; // dùng thận trọng
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancelOverdueDeposits(
    now = new Date(),
  ): Promise<ResponseCommon<{ cancelled: number }>> {
    const bookings = await this.bookingRepository.find({
      where: { status: BookingStatus.AWAITING_DEPOSIT },
    });
    let cancelled = 0;
    for (const booking of bookings) {
      const tenantLate =
        !booking.escrowDepositFundedAt &&
        booking.escrowDepositDueAt &&
        booking.escrowDepositDueAt < now;
      const landlordLate =
        !booking.landlordEscrowDepositFundedAt &&
        booking.landlordEscrowDepositDueAt &&
        booking.landlordEscrowDepositDueAt < now;
      if (tenantLate || landlordLate) {
        booking.status = BookingStatus.CANCELLED;
        await this.bookingRepository.save(booking);
        cancelled += 1;
      }
    }
    return new ResponseCommon(200, 'SUCCESS', { cancelled });
  }

  async findOne(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrFail(id);
    return new ResponseCommon(200, 'SUCCESS', booking);
  }

  async findAll(): Promise<ResponseCommon<Booking[]>> {
    const bookings = await this.bookingRepository.find({
      relations: ['tenant', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', bookings);
  }

  /**
   * Helper cho các service khác (Payment/IPN) đánh dấu mốc theo tenant + property
   */
  async markTenantDepositFundedByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<ResponseCommon<Booking>> {
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
  ): Promise<ResponseCommon<Booking>> {
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
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.findLatestByTenantAndProperty(
      tenantId,
      propertyId,
    );
    if (!booking)
      throw new NotFoundException('Booking not found for tenant/property');
    return this.markFirstRentPaid(booking.id);
  }

  private maybeMarkDualEscrowFunded(booking: Booking) {
    if (
      booking.escrowDepositFundedAt &&
      booking.landlordEscrowDepositFundedAt
    ) {
      booking.status = BookingStatus.DUAL_ESCROW_FUNDED;
      if (!booking.firstRentDueAt) {
        booking.firstRentDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }
    }
  }

  // --- Helpers ---
  private ensureStatus(booking: Booking, expected: BookingStatus[]) {
    if (!expected.includes(booking.status)) {
      throw new BadRequestException(
        `Invalid state: ${booking.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  private async loadBookingOrFail(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['tenant', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
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
