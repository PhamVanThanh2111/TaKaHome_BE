import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { zonedTimeToUtc } from 'date-fns-tz';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { FilterBookingDto, BookingCondition } from './dto/filter-booking.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Contract } from '../contract/entities/contract.entity';
import { ContractService } from '../contract/contract.service';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import {
  VN_TZ,
  addDaysVN,
  addHoursVN,
  vnNow,
  formatVN,
} from '../../common/datetime';
import { SmartCAService } from '../smartca/smartca.service';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { InvoiceService } from '../invoice/invoice.service';
import * as fs from 'fs';
import * as path from 'path';
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto';
import { Property } from '../property/entities/property.entity';
import { Room } from '../property/entities/room.entity';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import { User } from '../user/entities/user.entity';
import { RoleEnum } from '../common/enums/role.enum';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private contractService: ContractService,
    private smartcaService: SmartCAService,
    private s3StorageService: S3StorageService,
    @Inject(forwardRef(() => InvoiceService))
    private invoiceService: InvoiceService,
  ) {}

  async create(
    dto: CreateBookingDto,
    tenantId: string,
  ): Promise<ResponseCommon<Booking>> {
    // Validate input: either propertyId or roomId must be provided
    if (!dto.propertyId && !dto.roomId) {
      throw new BadRequestException(
        'Either propertyId or roomId must be provided',
      );
    }

    if (dto.propertyId && dto.roomId) {
      throw new BadRequestException(
        'Cannot provide both propertyId and roomId',
      );
    }

    let property: Property;
    let room: Room | undefined;

    if (dto.propertyId) {
      // HOUSING/APARTMENT: Book entire property
      const foundProperty = await this.propertyRepository.findOne({
        where: { id: dto.propertyId },
        relations: ['landlord'],
      });

      if (!foundProperty) {
        throw new NotFoundException(
          `Property with id ${dto.propertyId} not found`,
        );
      }

      if (foundProperty.isVisible === true) {
        throw new BadRequestException('Property is not already booked');
      }

      if (foundProperty.type === PropertyTypeEnum.BOARDING) {
        throw new BadRequestException(
          'For BOARDING property, use roomId instead of propertyId',
        );
      }

      property = foundProperty;
    } else {
      // BOARDING: Book specific room
      const foundRoom = await this.roomRepository.findOne({
        where: { id: dto.roomId },
        relations: ['property', 'property.landlord'],
      });

      if (!foundRoom) {
        throw new NotFoundException(`Room with id ${dto.roomId} not found`);
      }

      if (foundRoom.isVisible === true) {
        throw new BadRequestException('Room is not already booked');
      }

      if (foundRoom.property.type !== PropertyTypeEnum.BOARDING) {
        throw new BadRequestException(
          'roomId can only be used for BOARDING property type',
        );
      }

      room = foundRoom;
      property = foundRoom.property;
    }

    const booking = this.bookingRepository.create({
      tenant: { id: tenantId },
      property: { id: property.id },
      room: room ? { id: room.id } : undefined,
      status: BookingStatus.PENDING_LANDLORD,
    });

    const saved = await this.bookingRepository.save(booking);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async landlordApprove(
    id: string,
    userId: string,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_LANDLORD]);

    // Ensure contract exists before landlord signing
    const contract = await this.ensureContractForBooking(booking);
    if (!contract) {
      throw new BadRequestException(
        'Failed to create or retrieve contract for landlord approval',
      );
    }

    let signedPdfPresignedUrl: string | undefined;
    let keyUrl: string | undefined;

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
      const landlord = await this.userRepository.findOne({
        where: { id: userId },
      });
      // Landlord signs the contract (signatureIndex: 0)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer,
        signatureIndex: 0, // Landlord signature index
        userIdOverride: landlord?.CCCD,
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

      // Save transaction ID for landlord signing (signatureIndex: 0)
      if (signResult.transactionId) {
        await this.contractService.updateSignatureTransactionId(
          contract.id,
          signResult.transactionId,
          0, // LANDLORD signatureIndex
        );
      }

      // Upload the signed PDF to S3
      if (signResult.signedPdf) {
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

          keyUrl = uploadResult.url;

          // Generate presigned URL for 5 minutes access
          signedPdfPresignedUrl =
            await this.s3StorageService.getPresignedGetUrl(
              uploadResult.key,
              300, // 5 minutes
            );
        } catch (uploadError) {
          console.error(
            '[LandlordApprove] ⚠️ Failed to upload PDF to S3:',
            uploadError,
          );
        }
      }
    } catch (error) {
      console.error('[LandlordApprove] ❌ Landlord approval failed:', error);
      throw new BadRequestException(
        `Failed to complete landlord approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    if (contract) {
      booking.contract = contract;
      booking.contractId = contract.id;
    }

    if (!keyUrl) {
      throw new BadRequestException('Failed to upload signed PDF to storage');
    }

    // Update contract status to PENDING_SIGNATURE and integrate with blockchain
    try {
      await this.contractService.markPendingSignatureWithBlockchain(
        contract.id,
        keyUrl,
      );
    } catch (error) {
      console.error(
        '[LandlordApprove] ❌ Failed to mark contract as pending signature:',
        error,
      );
      // Still continue with the process even if blockchain integration fails
      // The blockchain sync will be retried later
      contract.contractFileUrl = keyUrl;
      await this.contractRepository.save(contract);
    }

    // After successful signing, update booking status
    booking.status = BookingStatus.PENDING_SIGNATURE;
    const saved = await this.bookingRepository.save(booking);

    // Update property/room visibility after successful landlord approval
    await this.updateVisibilityAfterApproval(booking);

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
    userId: string,
    depositDeadlineHours = 24,
  ): Promise<ResponseCommon<Booking>> {
    const booking = await this.loadBookingOrThrow(id);
    this.ensureStatus(booking, [BookingStatus.PENDING_SIGNATURE]);
    const contract = await this.ensureContractForBooking(booking);
    if (!contract) {
      throw new BadRequestException(
        'Failed to create or retrieve contract for tenant signing',
      );
    }

    if (!contract.contractFileUrl) {
      throw new BadRequestException(
        'Contract file URL not found. Landlord must sign first.',
      );
    }

    let signedPdfPresignedUrl: string | undefined;

    try {
      // 1. Download landlord-signed PDF from S3
      const s3Key = this.s3StorageService.extractKeyFromUrl(
        contract.contractFileUrl,
      );
      const landlordSignedPdf = await this.s3StorageService.downloadFile(s3Key);

      const tenant = await this.userRepository.findOne({
        where: { id: userId },
      });
      // 2. Tenant signs the PDF (signatureIndex: 1)
      const signResult = await this.smartcaService.signPdfOneShot({
        pdfBuffer: landlordSignedPdf,
        signatureIndex: 1, // Tenant signature index
        userIdOverride: tenant?.CCCD,
        contractId: contract.id,
        intervalMs: 2000,
        timeoutMs: 120000,
        reason: 'Tenant Contract Acceptance',
        location: 'Vietnam',
        contactInfo: '',
        signerName: 'Tenant Digital Signature',
        creator: 'SmartCA VNPT 2025',
      });

      if (!signResult.success) {
        throw new BadRequestException(
          `Tenant signing failed: ${signResult.error}`,
        );
      }

      // Save transaction ID for tenant signing (signatureIndex: 1)
      if (signResult.transactionId) {
        await this.contractService.updateSignatureTransactionId(
          contract.id,
          signResult.transactionId,
          1, // TENANT signatureIndex
        );
      }

      // 3. Upload the fully-signed PDF to S3
      if (signResult.signedPdf) {
        const uploadResult = await this.s3StorageService.uploadContractPdf(
          signResult.signedPdf,
          {
            contractId: contract.id,
            role: 'TENANT',
            signatureIndex: 1,
            metadata: {
              bookingId: booking.id,
              transactionId: signResult.transactionId || '',
              docId: signResult.docId || '',
              uploadedBy: 'system',
              signedAt: new Date().toISOString(),
              fullySignedContract: 'true',
            },
          },
        );

        // 4. Generate presigned URL for response
        signedPdfPresignedUrl = await this.s3StorageService.getPresignedGetUrl(
          uploadResult.key,
          300, // 5 minutes
        );

        // Update contract with new URL (fully-signed PDF)
        contract.contractFileUrl = uploadResult.url;
        await this.contractRepository.save(contract);
      }
    } catch (error) {
      console.error('[TenantSign] ❌ Tenant signing failed:', error);
      throw new BadRequestException(
        `Failed to complete tenant signing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // After successful tenant signing, update booking status
    booking.status = BookingStatus.AWAITING_DEPOSIT;
    const signedAt = vnNow();
    booking.signedAt = signedAt;
    booking.escrowDepositDueAt = addHoursVN(signedAt, depositDeadlineHours);
    booking.landlordEscrowDepositDueAt = addHoursVN(
      signedAt,
      depositDeadlineHours,
    );
    booking.firstRentDueAt = addHoursVN(signedAt, depositDeadlineHours * 3);

    if (contract) {
      booking.contract = contract;
      booking.contractId = contract.id;
    }

    const saved = await this.bookingRepository.save(booking);
    if (contract) {
      await this.markContractSigned(contract.id);
    }
    const refreshed = await this.loadBookingOrThrow(saved.id);

    // Return response with presigned URL to fully-signed PDF
    const response = {
      ...refreshed,
      signedPdfUrl: signedPdfPresignedUrl, // 5-minute expiry URL to fully-signed PDF
    };

    return new ResponseCommon(200, 'SUCCESS', response);
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
      await this.maybeMarkDualEscrowFunded(booking);
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
      await this.maybeMarkDualEscrowFunded(booking);
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
      relations: [
        'tenant',
        'property',
        'property.landlord',
        'room',
        'room.roomType',
        'contract',
      ],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    console.log(booking);
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

  async filterBookings(
    dto: FilterBookingDto,
    userId: string,
  ): Promise<ResponseCommon<Booking[]>> {
    const { condition, status } = dto;

    const queryBuilder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.tenant', 'tenant')
      .leftJoinAndSelect('booking.property', 'property')
      .leftJoinAndSelect('property.landlord', 'landlord')
      .leftJoinAndSelect('booking.contract', 'contract');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['account'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const roles = user.account.roles;
    // Filter by tenantId
    if (roles.includes(RoleEnum.TENANT)) {
      queryBuilder.andWhere('tenant.id = :tenantId', { tenantId: user.id });
    }

    // Filter by landlordId
    if (roles.includes(RoleEnum.LANDLORD)) {
      queryBuilder.andWhere('property.landlord.id = :landlordId', {
        landlordId: user.id,
      });
    }

    if (status) {
      queryBuilder.andWhere('booking.status = :status', { status });
    }

    // Filter by condition
    if (condition) {
      switch (condition) {
        case BookingCondition.NOT_APPROVED_YET:
          queryBuilder.andWhere('booking.status = :status', {
            status: BookingStatus.PENDING_LANDLORD,
          });
          break;
        case BookingCondition.NOT_APPROVED:
          queryBuilder.andWhere('booking.status = :status', {
            status: BookingStatus.REJECTED,
          });
          break;
        case BookingCondition.APPROVED:
          queryBuilder.andWhere('booking.status NOT IN (:...statuses)', {
            statuses: [
              BookingStatus.PENDING_LANDLORD,
              BookingStatus.REJECTED,
              BookingStatus.CANCELLED,
            ],
          });
          break;
      }
    }
    // add relations for room
    queryBuilder.leftJoinAndSelect('booking.room', 'room');
    queryBuilder.leftJoinAndSelect('room.roomType', 'roomType');
    queryBuilder.orderBy('booking.createdAt', 'DESC');

    const bookings = await queryBuilder.getMany();
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

  private async maybeMarkDualEscrowFunded(b: Booking) {
    const isRoom = !!b.room?.id;
    if (b.escrowDepositFundedAt && b.landlordEscrowDepositFundedAt) {
      b.status = BookingStatus.DUAL_ESCROW_FUNDED;
      try {
        // Lấy giá từ ContractExtension nếu có, nếu không thì dùng giá gốc
        const pricing = await this.contractService.getCurrentContractPricing(
          b.contractId!,
        );
        
        const invoice: CreateInvoiceDto = {
          contractId: b.contractId!,
          dueDate: formatVN(b.firstRentDueAt!, 'yyyy-MM-dd'),
          items: [
            {
              description: 'First month rent payment',
              amount: pricing.monthlyRent,
            },
          ],
          billingPeriod: formatVN(b.firstRentDueAt!, 'yyyy-MM'),
        };
        await this.invoiceService.create(invoice);
      } catch (error) {
        console.error('Failed to create invoice:', error);
      }

      if (!b.firstRentDueAt) {
        b.firstRentDueAt = addDaysVN(vnNow(), 3);
      }

      // Automatically create first month rent invoice when dual escrow is funded
      await this.createFirstMonthRentInvoice(b);
    }
  }

  /**
   * Create first month rent invoice when dual escrow is funded
   */
  private async createFirstMonthRentInvoice(booking: Booking): Promise<void> {
    try {
      // Load contract if not already loaded
      const contract =
        booking.contract || booking.contractId
          ? await this.contractRepository.findOne({
              where: { id: booking.contractId },
              relations: ['property'],
            })
          : null;

      if (!contract) {
        console.warn(
          `Cannot create first month rent invoice: missing contract for booking ${booking.id}`,
        );
        return;
      }

      // Check if invoice already exists for this contract (first month rent)
      const existingInvoices = await this.invoiceService.findByContract(
        contract.id,
      );
      const hasFirstMonthInvoice = existingInvoices.data?.some((invoice) =>
        invoice.items?.some(
          (item) =>
            item.description.toLowerCase().includes('first month') ||
            item.description.toLowerCase().includes('tháng đầu'),
        ),
      );

      if (hasFirstMonthInvoice) {
        console.log(
          `First month rent invoice already exists for contract ${contract.id}`,
        );
        return;
      }

      // Calculate monthly rent amount from ContractExtension or property
      const pricing = await this.contractService.getCurrentContractPricing(
        contract.id,
      );
      const monthlyRent = pricing.monthlyRent;
      
      if (!monthlyRent) {
        console.warn(
          `Cannot create invoice: missing price for contract ${contract.id}`,
        );
        return;
      }

      // Set due date to firstRentDueAt
      const dueDate = booking.firstRentDueAt || addDaysVN(vnNow(), 3);

      // Create invoice
      await this.invoiceService.create({
        contractId: contract.id,
        dueDate: formatVN(dueDate, 'yyyy-MM-dd'),
        items: [
          {
            description: 'First month rent payment',
            amount: monthlyRent,
          },
        ],
      });

      console.log(
        `✅ Created first month rent invoice for contract ${contract.id}, amount: ${monthlyRent}`,
      );
    } catch (error) {
      console.error('❌ Failed to create first month rent invoice:', error);
      // Don't throw - invoice creation failure shouldn't block dual escrow funding
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
      roomId: booking.room?.id,
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

  /**
   * Update property/room visibility after successful landlord approval
   */
  private async updateVisibilityAfterApproval(booking: Booking): Promise<void> {
    try {
      if (booking.room) {
        // BOARDING type: Update room visibility
        const room = await this.roomRepository.findOne({
          where: { id: booking.room.id },
          relations: ['property'],
        });

        if (room) {
          room.isVisible = true; // Make room visible
          await this.roomRepository.save(room);
        }
      } else {
        // HOUSING/APARTMENT type: Update property visibility
        const property = await this.propertyRepository.findOne({
          where: { id: booking.property.id },
        });

        if (property) {
          property.isVisible = true; // Make property visible
          await this.propertyRepository.save(property);
        }
      }
    } catch (error) {
      this.logWorkflowError(
        'Failed to update visibility after approval',
        {
          bookingId: booking.id,
          propertyId: booking.property?.id,
          roomId: booking.room?.id,
        },
        error,
      );
    }
  }
}
