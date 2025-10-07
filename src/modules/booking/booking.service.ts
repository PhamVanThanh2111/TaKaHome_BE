import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { zonedTimeToUtc } from 'date-fns-tz';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Contract } from '../contract/entities/contract.entity';
import { ContractService } from '../contract/contract.service';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { VN_TZ, addDaysVN, addHoursVN, vnNow } from '../../common/datetime';
import { SmartCAService } from '../smartca/smartca.service';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private contractService: ContractService,
    private smartcaService: SmartCAService,
    private s3StorageService: S3StorageService,
  ) {}

  async create(dto: CreateBookingDto): Promise<ResponseCommon<Booking>> {
    const booking = this.bookingRepository.create({
      tenant: { id: dto.tenantId },
      property: { id: dto.propertyId },
      status: BookingStatus.PENDING_LANDLORD,
      firstRentDueAt: this.parseOptionalInput(dto.firstRentDueAt),
    });
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async landlordApprove(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_LANDLORD]);

    // Ensure contract exists before landlord signing
    const contract = await this.ensureContractForBooking(booking);
    if (!contract) {
      throw new BadRequestException(
        'Failed to create or retrieve contract for landlord approval',
      );
    }

    console.log('[LandlordApprove] Starting landlord PDF signing process');

    let signedPdfPresignedUrl: string | undefined;

    try {
      // Read PDF file from assets
      const pdfPath = path.join(
        process.cwd(),
        'src',
        'assets',
        'contracts',
        'HopDongChoThueNhaNguyenCan.pdf',
      );

      if (!fs.existsSync(pdfPath)) {
        throw new BadRequestException(`PDF file not found at: ${pdfPath}`);
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log(
        `[LandlordApprove] Loaded PDF from assets: ${pdfBuffer.length} bytes`,
      );

      // Landlord signs the contract (signatureIndex: 0)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer,
        signatureIndex: 0, // Landlord signature index
        contractId: contract.id,
        intervalMs: 2000,
        timeoutMs: 120000,
        reason: 'Landlord Contract Approval',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Landlord Digital Signature',
        creator: 'SmartCA VNPT 2025',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Landlord signing failed: ${signResult.error}`,
        );
      }

      console.log(
        '[LandlordApprove] ✅ Landlord signing completed successfully',
      );

      // Upload the signed PDF to S3
      if (signResult.signedPdf) {
        console.log('[LandlordApprove] Uploading signed PDF to S3...');

        try {
          const uploadResult = await this.s3StorageService.uploadContractPdf(
            signResult.signedPdf,
            {
              contractId: contract.id,
              role: 'LANDLORD',
              signatureIndex: 0,
              metadata: {
                bookingId: booking.id,
                transactionId: signResult.transactionId || '',
                docId: signResult.docId || '',
                uploadedBy: 'system',
                signedAt: new Date().toISOString(),
              },
            },
          );

          console.log(
            '[LandlordApprove] ✅ PDF uploaded to S3:',
            uploadResult.key,
          );

          // Generate presigned URL for 5 minutes access
          signedPdfPresignedUrl =
            await this.s3StorageService.getPresignedGetUrl(
              uploadResult.key,
              300, // 5 minutes
            );

          console.log(
            '[LandlordApprove] 🔗 Generated presigned URL (expires in 5 minutes)',
          );

          // TODO: Optionally save the S3 key/URL to contract or booking entity
          // contract.landlordSignedPdfUrl = uploadResult.url;
          // contract.landlordSignedPdfKey = uploadResult.key;
        } catch (uploadError) {
          console.error(
            '[LandlordApprove] ⚠️ Failed to upload PDF to S3:',
            uploadError,
          );
          // Don't fail the entire operation if S3 upload fails
          // The signing was successful, just the storage failed
        }
      }
    } catch (error) {
      console.error('[LandlordApprove] ❌ Landlord signing failed:', error);
      throw new BadRequestException(
        `Failed to complete landlord signing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // After successful signing, update booking status
    booking.status = BookingStatus.PENDING_SIGNATURE;

    if (contract) {
      booking.contract = contract;
      booking.contractId = contract.id;
    }
    const saved = await this.bookingRepository.save(booking);

    // Return response with presigned URL
    const response = {
      ...saved,
      signedPdfUrl: signedPdfPresignedUrl, // 5-minute expiry URL
    };

    return new ResponseCommon(200, 'SUCCESS', response);
  }

  async landlordReject(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    booking.status = BookingStatus.REJECTED;
    await this.cancelContractIfExists(booking);
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async tenantSign(
    id: string,
    depositDeadlineHours = 24,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_SIGNATURE]);
    const contract = await this.ensureContractForBooking(booking);
    if (contract) {
      booking.contract = contract;
      booking.contractId = contract.id;
    }
    booking.status = BookingStatus.AWAITING_DEPOSIT;
    const signedAt = vnNow();
    booking.signedAt = signedAt;
    booking.escrowDepositDueAt = addHoursVN(signedAt, depositDeadlineHours);
    booking.landlordEscrowDepositDueAt = addHoursVN(
      signedAt,
      depositDeadlineHours,
    );
    booking.firstRentDueAt = addHoursVN(signedAt, depositDeadlineHours * 3);
    const saved = await this.bookingRepository.save(booking);
    if (contract) {
      await this.markContractSigned(contract.id);
    }
    const refreshed = await this.loadBookingOrThrow(saved.id);
    return new ResponseCommon(200, 'SUCCESS', refreshed);
  }

  // Gọi khi IPN ký quỹ Người thuê thành công
  async markTenantDepositFunded(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    if (booking.escrowDepositFundedAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [
      BookingStatus.AWAITING_DEPOSIT,
      BookingStatus.ESCROW_FUNDED_L,
    ]);
    booking.escrowDepositFundedAt = vnNow();
    if (booking.landlordEscrowDepositFundedAt) {
      this.maybeMarkDualEscrowFunded(booking);
    } else {
      booking.status = BookingStatus.ESCROW_FUNDED_T;
    }
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // Gọi khi IPN ký quỹ Chủ nhà thành công
  async markLandlordDepositFunded(
    id: string,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    if (booking.landlordEscrowDepositFundedAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [
      BookingStatus.AWAITING_DEPOSIT,
      BookingStatus.ESCROW_FUNDED_T,
    ]);
    booking.landlordEscrowDepositFundedAt = vnNow();
    if (booking.escrowDepositFundedAt) {
      this.maybeMarkDualEscrowFunded(booking);
    } else {
      booking.status = BookingStatus.ESCROW_FUNDED_L;
    }
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // Gọi khi thanh toán kỳ đầu thành công (IPN vnpay hoặc ví)
  async markFirstRentPaid(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    if (booking.firstRentPaidAt) {
      return new ResponseCommon(200, 'SUCCESS', booking);
    }
    this.ensureStatus(booking, [BookingStatus.DUAL_ESCROW_FUNDED]);
    booking.status = BookingStatus.READY_FOR_HANDOVER;
    booking.firstRentPaidAt = vnNow();
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async handover(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.READY_FOR_HANDOVER]);
    booking.status = BookingStatus.ACTIVE;
    const handoverAt = vnNow();
    booking.handoverAt = handoverAt;
    booking.activatedAt = handoverAt;
    const saved = await this.bookingRepository.save(booking);
    await this.activateContractIfPossible(booking);
    const refreshed = await this.loadBookingOrThrow(saved.id);
    return new ResponseCommon(200, 'SUCCESS', refreshed);
  }

  async startSettlement(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.ACTIVE]);
    booking.status = BookingStatus.SETTLEMENT_PENDING;
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async closeSettled(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.SETTLEMENT_PENDING]);
    booking.status = BookingStatus.SETTLED;
    booking.closedAt = vnNow();
    const saved = await this.bookingRepository.save(booking);
    await this.completeContractIfPossible(booking);
    const refreshed = await this.loadBookingOrThrow(saved.id);
    return new ResponseCommon(200, 'SUCCESS', refreshed);
  }

  async updateMeta(
    id: string,
    dto: UpdateBookingDto,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    if (dto.escrowDepositDueAt)
      booking.escrowDepositDueAt = this.parseInput(dto.escrowDepositDueAt);
    if (dto.firstRentDueAt)
      booking.firstRentDueAt = this.parseInput(dto.firstRentDueAt);
    if (dto.status) booking.status = dto.status; // dùng thận trọng
    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancelOverdueDeposits(
    now = vnNow(),
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

  private async loadBookingOrThrow(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['tenant', 'property', 'property.landlord'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async findOne(id: string): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
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

  private parseInput(value: string): Date {
    const normalized = value.length === 10 ? `${value}T00:00:00` : value;
    const parsed = zonedTimeToUtc(normalized, VN_TZ);
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date input provided');
    }
    return parsed;
  }

  private parseOptionalInput(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    return this.parseInput(value);
  }

  private maybeMarkDualEscrowFunded(b: Booking) {
    if (b.escrowDepositFundedAt && b.landlordEscrowDepositFundedAt) {
      b.status = BookingStatus.DUAL_ESCROW_FUNDED;
      if (!b.firstRentDueAt) {
        b.firstRentDueAt = addDaysVN(vnNow(), 3);
      }
    }
  }

  private isReusableContract(contract?: Contract | null): contract is Contract {
    if (!contract) return false;
    return [
      ContractStatusEnum.DRAFT,
      ContractStatusEnum.PENDING_SIGNATURE,
      ContractStatusEnum.SIGNED,
    ].includes(contract.status);
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

  // --- Helpers ---
  private ensureStatus(b: Booking, expected: BookingStatus[]) {
    if (!expected.includes(b.status)) {
      throw new BadRequestException(
        `Invalid state: ${b.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  private async ensureContractForBooking(
    booking: Booking,
  ): Promise<Contract | null> {
    const tenantId = booking.tenant?.id;
    const propertyId = booking.property?.id;
    const landlordId = booking.property?.landlord?.id;

    if (!tenantId || !propertyId || !landlordId) {
      throw new BadRequestException(
        'Booking is missing tenant, property, or landlord information',
      );
    }

    if (booking.contractId) {
      const linked = await this.contractService.findRawById(booking.contractId);
      if (this.isReusableContract(linked)) {
        return linked;
      }
    }

    const latest = await this.contractService.findLatestByTenantAndProperty(
      tenantId,
      propertyId,
    );
    if (this.isReusableContract(latest)) {
      booking.contractId = latest.id;
      return latest;
    }

    const draft = await this.contractService.createDraftForBooking({
      tenantId,
      landlordId,
      propertyId,
      startDate: booking.signedAt ?? vnNow(),
    });
    booking.contractId = draft.id;
    return draft;
  }

  private async markContractSigned(contractId: string): Promise<void> {
    try {
      await this.contractService.markSigned(contractId);
    } catch (error) {
      this.logWorkflowError(
        'Failed to mark contract as signed',
        { contractId },
        error,
      );
    }
  }

  private async cancelContractIfExists(booking: Booking) {
    if (!booking.contractId) return;
    try {
      const contract = await this.contractService.findRawById(
        booking.contractId,
      );
      if (!this.isReusableContract(contract)) {
        return;
      }
      await this.contractService.cancel(booking.contractId);
    } catch (error) {
      this.logWorkflowError(
        'Failed to cancel contract for booking',
        { bookingId: booking.id, contractId: booking.contractId },
        error,
      );
    }
  }

  private async activateContractIfPossible(booking: Booking) {
    if (!booking.contractId) return;
    try {
      await this.contractService.activate(booking.contractId);
    } catch (error) {
      this.logWorkflowError(
        'Failed to activate contract for booking',
        { bookingId: booking.id, contractId: booking.contractId },
        error,
      );
    }
  }

  private async completeContractIfPossible(booking: Booking) {
    if (!booking.contractId) return;
    try {
      await this.contractService.complete(booking.contractId);
    } catch (error) {
      this.logWorkflowError(
        'Failed to complete contract for booking',
        { bookingId: booking.id, contractId: booking.contractId },
        error,
      );
    }
  }

  private logWorkflowError(
    message: string,
    context: Record<string, unknown>,
    error: unknown,
  ) {
    const normalized =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { raw: error };
    console.error(message, { ...context, ...normalized });
  }
}
