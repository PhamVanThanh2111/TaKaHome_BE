/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { zonedTimeToUtc } from 'date-fns-tz';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateUtilityBillDto } from './dto/create-utility-bill.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { Contract } from '../contract/entities/contract.entity';
import { InvoiceStatusEnum } from '../common/enums/invoice-status.enum';
import { ServiceTypeEnum } from '../common/enums/service-type.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';
import { INVOICE_ERRORS } from 'src/common/constants/error-messages.constant';

// DTO for process invoice feature
export interface InvoiceExtractionResultDto {
  name: string;
  value: string;
  confidence: number;
}

export interface ProcessInvoiceResponseDto {
  extractedData: InvoiceExtractionResultDto[];
  rawData?: any;
}

@Injectable()
export class InvoiceService {
  private documentAIClient: DocumentProcessorServiceClient | null;
  private processorId: string | undefined;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepository: Repository<InvoiceItem>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private configService: ConfigService,
  ) {
    // Khởi tạo Google Document AI client với cấu hình an toàn
    const keyFileContent = this.configService.get<string>(
      'GOOGLE_CLOUD_KEY_FILE',
    );
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');

    if (keyFileContent && projectId) {
      try {
        // Parse JSON credentials từ biến môi trường
        let credentials: any;
        try {
          credentials = JSON.parse(keyFileContent);
        } catch (parseError) {
          console.warn(
            'Không thể parse Google Cloud credentials JSON:',
            (parseError as Error).message,
          );
          this.documentAIClient = null;
          this.processorId = this.configService.get<string>(
            'GOOGLE_DOCUMENT_AI_PROCESSOR_ID',
          );
          return;
        }

        this.documentAIClient = new DocumentProcessorServiceClient({
          credentials: credentials,
          projectId: projectId,
          // Thêm timeout để tránh hang
          timeout: 30000, // 30 seconds
        });
      } catch (error) {
        console.warn(
          'Không thể khởi tạo Google Document AI client:',
          (error as Error).message,
        );
        this.documentAIClient = null;
      }
    } else {
      console.warn(
        'Google Cloud cấu hình chưa đầy đủ. Document AI sẽ không khả dụng.',
      );
      this.documentAIClient = null;
    }

    this.processorId = this.configService.get<string>(
      'GOOGLE_DOCUMENT_AI_PROCESSOR_ID',
    );
  }

  async create(dto: CreateInvoiceDto): Promise<ResponseCommon<Invoice>> {
    // Validate DAMAGE_COMPENSATION serviceType: chỉ cho phép tạo trong 7 ngày cuối hợp đồng
    const hasDamageCompensation = dto.items.some(
      (item) => item.serviceType === ServiceTypeEnum.DAMAGE_COMPENSATION,
    );

    if (hasDamageCompensation) {
      // Lấy thông tin hợp đồng để kiểm tra endDate
      const contract = await this.contractRepository.findOne({
        where: { id: dto.contractId },
      });

      if (!contract) {
        throw new BadRequestException(INVOICE_ERRORS.CONTRACT_NOT_FOUND);
      }

      // Tính số giờ còn lại đến khi hợp đồng kết thúc
      // Demo: 1 giờ = 1 ngày => 7 ngày = 7 giờ
      const now = vnNow();
      const endDate = contract.endDate;
      const hoursUntilEnd =
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Chỉ cho phép tạo hóa đơn DAMAGE_COMPENSATION trong 7 giờ cuối cùng của hợp đồng
      if (hoursUntilEnd > 7 || hoursUntilEnd < 0) {
        throw new BadRequestException(
          INVOICE_ERRORS.DAMAGE_COMPENSATION_TIMING_INVALID,
        );
      }
    }

    const items = dto.items.map((i) => this.itemRepository.create(i));
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const code = this.generateCode();
    const dueInput =
      dto.dueDate.length === 10 ? `${dto.dueDate}T00:00:00` : dto.dueDate;
    const invoice = this.invoiceRepository.create({
      invoiceCode: code,
      contract: { id: dto.contractId },
      dueDate: zonedTimeToUtc(dueInput, VN_TZ),
      items,
      billingPeriod: dto.billingPeriod,
      totalAmount: total,
    });
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async createUtilityBill(
    dto: CreateUtilityBillDto,
  ): Promise<ResponseCommon<Invoice>> {
    // Backward compatibility: nếu sử dụng old format, convert sang new format
    // Validate services array
    if (!dto.services || dto.services.length === 0) {
      throw new BadRequestException(INVOICE_ERRORS.SERVICE_LIST_EMPTY);
    }

    // Kiểm tra duplicate serviceType trong cùng một invoice
    const serviceTypes = dto.services.map((s) => s.serviceType);
    const uniqueServiceTypes = new Set(serviceTypes);
    if (serviceTypes.length !== uniqueServiceTypes.size) {
      throw new BadRequestException(
        INVOICE_ERRORS.DUPLICATE_SERVICE_TYPE,
      );
    }

    // Validate DAMAGE_COMPENSATION: chỉ cho phép tạo trong 7 ngày cuối hợp đồng
    const hasDamageCompensation = dto.services.some(
      (s) => s.serviceType === ServiceTypeEnum.DAMAGE_COMPENSATION,
    );

    if (hasDamageCompensation) {
      // Lấy thông tin hợp đồng để kiểm tra endDate
      const contractForValidation = await this.contractRepository.findOne({
        where: { id: dto.contractId },
      });

      if (!contractForValidation) {
        throw new BadRequestException(INVOICE_ERRORS.CONTRACT_NOT_FOUND);
      }

      // Tính số giờ còn lại đến khi hợp đồng kết thúc
      // Demo: 1 giờ = 1 ngày => 7 ngày = 7 giờ
      const now = vnNow();
      const endDate = contractForValidation.endDate;
      const hoursUntilEnd =
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Chỉ cho phép tạo hóa đơn DAMAGE_COMPENSATION trong 7 giờ cuối cùng của hợp đồng
      if (hoursUntilEnd > 7 || hoursUntilEnd < 0) {
        throw new BadRequestException(
          INVOICE_ERRORS.DAMAGE_COMPENSATION_TIMING_INVALID,
        );
      }
    }

    // Validate từng service item
    for (const service of dto.services) {
      if (
        service.serviceType === ServiceTypeEnum.ELECTRICITY &&
        !service.KwhNo
      ) {
        throw new BadRequestException(
          INVOICE_ERRORS.KWH_NO_REQUIRED,
        );
      }
      if (service.serviceType === ServiceTypeEnum.WATER && !service.M3No) {
        throw new BadRequestException(INVOICE_ERRORS.M3_NO_REQUIRED);
      }
      if (
        service.serviceType !== ServiceTypeEnum.ELECTRICITY &&
        service.serviceType !== ServiceTypeEnum.WATER &&
        !service.amount
      ) {
        throw new BadRequestException(
          INVOICE_ERRORS.PAYMENT_DETAILS_MISSING,
        );
      }
    }

    // Lấy thông tin contract với property để tính giá
    const contract = await this.contractRepository.findOne({
      where: { id: dto.contractId },
      relations: ['property', 'room', 'room.roomType'],
    });

    if (!contract) {
      throw new BadRequestException(INVOICE_ERRORS.CONTRACT_NOT_FOUND);
    }

    if (!contract.property) {
      throw new BadRequestException(INVOICE_ERRORS.CONTRACT_NO_PROPERTY);
    }

    // Kiểm tra duplicate trong database cho từng service type
    for (const service of dto.services) {
      // Tìm tất cả invoices của contract trong billingPeriod này
      const existingInvoices = await this.invoiceRepository.find({
        where: {
          contract: { id: dto.contractId },
          billingPeriod: dto.billingPeriod,
        },
        relations: ['items'],
      });

      // Kiểm tra xem có item nào với serviceType trùng lặp không
      const hasExistingServiceType = existingInvoices.some((invoice) =>
        invoice.items.some((item) => item.serviceType === service.serviceType),
      );

      if (hasExistingServiceType) {
        throw new BadRequestException(
          INVOICE_ERRORS.DUPLICATE_SERVICE_TYPE,
        );
      }
    }

    // Tạo invoice items cho từng service
    const invoiceItems: InvoiceItem[] = [];
    let totalInvoiceAmount = 0;

    for (const service of dto.services) {
      let itemAmount = 0;
      let itemDescription = '';

      if (
        service.serviceType === ServiceTypeEnum.ELECTRICITY &&
        service.KwhNo
      ) {
        // Hóa đơn tiền điện
        const electricityPrice = contract.property.electricityPricePerKwh;
        if (!electricityPrice) {
          throw new BadRequestException(
            INVOICE_ERRORS.PAYMENT_DETAILS_MISSING,
          );
        }
        itemAmount = service.KwhNo * Number(electricityPrice);
        itemDescription =
          service.description ||
          `Tiền điện tháng ${dto.billingPeriod}: ${service.KwhNo} kWh × ${Number(electricityPrice).toLocaleString('vi-VN')} VND/kWh`;
      } else if (
        service.serviceType === ServiceTypeEnum.WATER &&
        service.M3No
      ) {
        // Hóa đơn tiền nước
        const waterPrice = contract.property.waterPricePerM3;
        if (!waterPrice) {
          throw new BadRequestException(
            INVOICE_ERRORS.PAYMENT_DETAILS_MISSING,
          );
        }
        itemAmount = service.M3No * Number(waterPrice);
        itemDescription =
          service.description ||
          `Tiền nước tháng ${dto.billingPeriod}: ${service.M3No} m³ × ${Number(waterPrice).toLocaleString('vi-VN')} VND/m³`;
      } else {
        // Các dịch vụ khác
        if (!service.amount) {
          throw new BadRequestException(
            INVOICE_ERRORS.PAYMENT_DETAILS_MISSING,
          );
        }
        itemAmount = service.amount;
        itemDescription =
          service.description ||
          `Tiền dịch vụ ${service.serviceType}${dto.billingPeriod ? ' tháng ' + dto.billingPeriod : ''}`;
      }

      const invoiceItem = this.itemRepository.create({
        description: itemDescription,
        amount: itemAmount,
        serviceType: service.serviceType,
      });

      invoiceItems.push(invoiceItem);
      totalInvoiceAmount += itemAmount;
    }

    // Tạo invoice
    const code = this.generateCode();
    const dueInput =
      dto.dueDate.length === 10 ? `${dto.dueDate}T00:00:00` : dto.dueDate;

    const invoice = this.invoiceRepository.create({
      invoiceCode: code,
      contract: { id: dto.contractId },
      dueDate: zonedTimeToUtc(dueInput, VN_TZ),
      items: invoiceItems,
      totalAmount: totalInvoiceAmount,
      billingPeriod: dto.billingPeriod,
      status: InvoiceStatusEnum.PENDING,
    });

    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Invoice[]>> {
    const invoices = await this.invoiceRepository.find({
      relations: ['items', 'contract', 'payments'],
    });
    return new ResponseCommon(200, 'SUCCESS', invoices);
  }

  async findOne(id: string): Promise<ResponseCommon<Invoice | null>> {
    const invoice = await this.loadInvoice(id);
    return new ResponseCommon(200, 'SUCCESS', invoice);
  }

  async findByContract(contractId: string): Promise<ResponseCommon<Invoice[]>> {
    const invoices = await this.invoiceRepository.find({
      where: { contract: { id: contractId } },
      relations: ['items', 'contract', 'payment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', invoices);
  }

  async findPendingByUser(userId: string): Promise<ResponseCommon<Invoice[]>> {
    const invoices = await this.invoiceRepository.find({
      where: {
        status: InvoiceStatusEnum.PENDING,
        contract: { tenant: { id: userId } },
      },
      relations: ['items', 'contract', 'contract.property', 'payments'],
      order: { dueDate: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', invoices);
  }

  async markPaid(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoice(id);
    if (!invoice) throw new NotFoundException(INVOICE_ERRORS.INVOICE_NOT_FOUND);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.PAID;
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancel(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoice(id);
    if (!invoice) throw new NotFoundException(INVOICE_ERRORS.INVOICE_NOT_FOUND);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.CANCELLED;
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // ---- Helper methods ----
  private generateCode() {
    const now = vnNow();
    const yyyymmdd = formatVN(now, 'yyyyMMdd');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase(); // 4 kí tự
    return `INV-${yyyymmdd}-${rand}`;
  }

  private isValidProjectId(projectId: string): boolean {
    // Google Cloud project IDs must be between 6 and 30 characters
    // and can only contain lowercase letters, numbers, and hyphens
    const regex = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
    return regex.test(projectId);
  }

  private ensureStatus(invoice: Invoice, expected: InvoiceStatusEnum[]) {
    if (!expected.includes(invoice.status)) {
      throw new BadRequestException(
        `Invalid state: ${invoice.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  private loadInvoice(id: string): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({
      where: { id },
      relations: ['items', 'contract', 'payment'],
    });
  }

  // ---- Google Document AI methods ----
  async processInvoiceImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ResponseCommon<ProcessInvoiceResponseDto>> {
    try {
      // Mark parameters as used to satisfy linter in mock mode
      // void _imageBuffer;
      // void _mimeType;
      // NOTE: Temporarily using a mock implementation to avoid incurring
      // Google Document AI calls while testing / on CI/deploy environments.
      // The original live request has been commented out below for reference.

      // ----- Live Document AI call (commented) -----
      // Kiểm tra cấu hình Google Cloud
      // if (!this.documentAIClient) {
      //   throw new Error(
      //     'Google Document AI chưa được cấu hình. Sử dụng dữ liệu mẫu.',
      //   );
      // }

      // if (!this.processorId) {
      //   throw new Error(
      //     'Processor ID chưa được cấu hình. Sử dụng dữ liệu mẫu.',
      //   );
      // }

      // // Kiểm tra project ID format
      // const projectId = this.configService.get<string>(
      //   'GOOGLE_CLOUD_PROJECT_ID',
      // );
      // if (!projectId || !this.isValidProjectId(projectId)) {
      //   throw new Error('Project ID không hợp lệ. Sử dụng dữ liệu mẫu.');
      // }

      // const encodedImage = imageBuffer.toString('base64');

      // // Tạo promise với timeout để tránh hang
      // const processPromise = this.documentAIClient.processDocument({
      //   name: this.processorId,
      //   rawDocument: {
      //     content: encodedImage,
      //     mimeType: mimeType,
      //   },
      // });

      // // Thêm timeout wrapper
      // const timeoutPromise = new Promise((_, reject) =>
      //   setTimeout(
      //     () => reject(new Error('Request timeout after 25 seconds')),
      //     25000,
      //   ),
      // );

      // const result = (await Promise.race([
      //   processPromise,
      //   timeoutPromise,
      // ])) as any;
      // const [processResult] = result as any[];

      // const entities = (processResult?.document?.entities || []) as any[];

      // const extractedData = Array.isArray(entities)
      //   ? entities.map((entity: any) => ({
      //       name: (entity?.type as string) || 'unknown',
      //       value:
      //         (entity?.mentionText as string) ||
      //         (entity?.normalizedValue?.text as string) ||
      //         'N/A',
      //       confidence: (entity?.confidence as number) || 0,
      //     }))
      //   : [];

      // // Trả về response với rawData đã được simplified để tránh quá lớn
      // const documentText = processResult?.document?.text as string | undefined;
      // return new ResponseCommon(200, 'Xử lý hóa đơn thành công', {
      //   extractedData,
      //   rawData: {
      //     entitiesCount: extractedData.length,
      //     documentText: documentText
      //       ? documentText.substring(0, 500) + '...'
      //       : 'N/A',
      //     processedAt: new Date().toISOString(),
      //   },
      // });

      // ----- Mock response (used instead of live Document AI) -----
      // Keep function async-compatible by returning a resolved Promise
      return Promise.resolve(this.mockProcessInvoiceResponse());
    } catch (error) {
      console.error('Lỗi khi xử lý hóa đơn với Google Document AI:', error);
      // Trả về response lỗi để đảm bảo hàm luôn có return theo kiểu ProcessInvoiceResponseDto
      return new ResponseCommon(
        500,
        'Lỗi khi xử lý hóa đơn với Google Document AI',
        {
          extractedData: [],
          rawData: {
            error: (error as Error)?.message ?? String(error),
            stack: (error as Error)?.stack ?? null,
            processedAt: new Date().toISOString(),
          },
        },
      );
    }
  }

  /**
   * Trả về dữ liệu mock giống như response từ Document AI để tiết kiệm chi phí
   */
  private mockProcessInvoiceResponse(): ResponseCommon<ProcessInvoiceResponseDto> {
    return new ResponseCommon(200, 'SUCCESS', {
      extractedData: [
        {
          name: 'net_amount',
          value: '116.000',
          confidence: 0.5832309126853943,
        },
        {
          name: 'invoice_type',
          value: 'restaurant_statement',
          confidence: 0.4611542522907257,
        },
        {
          name: 'receiver_name',
          value: 'Quách',
          confidence: 0.3313143849372864,
        },
        {
          name: 'total_amount',
          value: '133.400',
          confidence: 0.3292408883571625,
        },
        {
          name: 'supplier_phone',
          value: '024 7300 9866',
          confidence: 0.24820193648338318,
        },
        {
          name: 'supplier_name',
          value: 'CÔNG TY TNHH MỘT THÀNH VIÊN NƯỚC S',
          confidence: 0.13891878724098206,
        },
        { name: 'line_item', value: '4 DV 29.000 116.000', confidence: 1 },
      ],
      rawData: {
        entitiesCount: 7,
        documentText:
          'NU\nTY\nOC SACH\nKý hiệu: 1K25TAE\nSố: 00065565\nCÔNG TY TNHH MỘT THÀNH VIÊN NƯỚC SẠCH HÀ NỘI\nĐịa chi: 44- đường Yên Phụ, Phường Trúc Bạch, Quận Ba Đình, Thành phố Hà Nội\nMã số thuế: 0100106225\nXí nghiệp Kinh doanh Nước sạch Cầu Giấy\nHA NOI\nHÓA ĐƠN GIÁ TRỊ GIA TĂNG (TIỀN NƯỚC)\n(Bản thể hiện của hóa đơn điện tử)\nTháng 01 năm 2025\nTên khách hàng: Quách Kim Cúc\nĐịa chi: N181/9/B11 Xuân Thuỷ\nMã hóa đơn:525010655653\nMã số khách hàng: 512002769\nSố hộ sử dụng: 1\nKhối Số đọc:E045-9076\nTài khoản:\nMã số thuế:\n...',
        processedAt: '2025-10-23T09:45:51.344Z',
      },
    });
  }
}
