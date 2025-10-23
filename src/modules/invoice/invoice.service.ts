/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { zonedTimeToUtc } from 'date-fns-tz';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceStatusEnum } from '../common/enums/invoice-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';

// DTO for process invoice feature
export interface InvoiceExtractionResultDto {
  name: string;
  value: string;
  confidence: number;
}

export interface ProcessInvoiceResponseDto {
  status: string;
  message: string;
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
    private configService: ConfigService,
  ) {
    // Khởi tạo Google Document AI client với cấu hình an toàn
    const keyFileContent = this.configService.get<string>('GOOGLE_CLOUD_KEY_FILE');
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    
    if (keyFileContent && projectId) {
      try {
        // Parse JSON credentials từ biến môi trường
        let credentials: any;
        try {
          credentials = JSON.parse(keyFileContent);
        } catch (parseError) {
          console.warn('Không thể parse Google Cloud credentials JSON:', (parseError as Error).message);
          this.documentAIClient = null;
          this.processorId = this.configService.get<string>('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
          return;
        }

        this.documentAIClient = new DocumentProcessorServiceClient({
          credentials: credentials,
          projectId: projectId,
          // Thêm timeout để tránh hang
          timeout: 30000, // 30 seconds
        });
      } catch (error) {
        console.warn('Không thể khởi tạo Google Document AI client:', (error as Error).message);
        this.documentAIClient = null;
      }
    } else {
      console.warn('Google Cloud cấu hình chưa đầy đủ. Document AI sẽ không khả dụng.');
      this.documentAIClient = null;
    }
    
    this.processorId = this.configService.get<string>('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
  }

  async create(dto: CreateInvoiceDto): Promise<ResponseCommon<Invoice>> {
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
      totalAmount: total,
      billingPeriod: dto.billingPeriod,
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
    if (!invoice) throw new Error(`Invoice with id ${id} not found`);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.PAID;
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancel(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoice(id);
    if (!invoice) throw new Error(`Invoice with id ${id} not found`);
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
      relations: ['items', 'contract', 'payments'],
    });
  }

  // ---- Google Document AI methods ----
  async processInvoiceImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ProcessInvoiceResponseDto> {
    
    try {
      // Kiểm tra cấu hình Google Cloud
      if (!this.documentAIClient) {
        throw new Error('Google Document AI chưa được cấu hình. Sử dụng dữ liệu mẫu.');
      }

      if (!this.processorId) {
        throw new Error('Processor ID chưa được cấu hình. Sử dụng dữ liệu mẫu.');
      }

      // Kiểm tra project ID format
      const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
      if (!projectId || !this.isValidProjectId(projectId)) {
        throw new Error('Project ID không hợp lệ. Sử dụng dữ liệu mẫu.');
      }

      const encodedImage = imageBuffer.toString('base64');

      // Tạo promise với timeout để tránh hang
      const processPromise = this.documentAIClient.processDocument({
        name: this.processorId,
        rawDocument: {
          content: encodedImage,
          mimeType: mimeType,
        },
      });

      // Thêm timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 25 seconds')), 25000)
      );

      const result = await Promise.race([processPromise, timeoutPromise]) as any;
      const [processResult] = result as any[];

      const entities = processResult?.document?.entities || [];

      const extractedData = Array.isArray(entities) ? entities.map((entity: any) => ({
        name: entity?.type || 'unknown',
        value: entity?.mentionText || entity?.normalizedValue?.text || 'N/A',
        confidence: entity?.confidence || 0,
      })) : [];

      // Trả về response với rawData đã được simplified để tránh quá lớn
      return {
        status: 'success',
        message: 'Xử lý hóa đơn thành công',
        extractedData,
        rawData: {
          entitiesCount: extractedData.length,
          documentText: processResult?.document?.text?.substring(0, 500) + '...' || 'N/A',
          processedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      console.error('Lỗi khi xử lý hóa đơn với Google Document AI:', error);
      // Trả về response lỗi để đảm bảo hàm luôn có return theo kiểu ProcessInvoiceResponseDto
      return {
        status: 'error',
        message: 'Lỗi khi xử lý hóa đơn với Google Document AI',
        extractedData: [],
        rawData: {
          error: (error as Error)?.message ?? String(error),
          stack: (error as Error)?.stack ?? null,
          processedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Kiểm tra tính hợp lệ của Google Cloud Project ID
   */
  private isValidProjectId(projectId: string): boolean {
    // Project ID phải có độ dài 6-30 ký tự, chỉ chứa chữ thường, số và dấu gạch ngang
    const projectIdRegex = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
    return projectIdRegex.test(projectId);
  }
}
