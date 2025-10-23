import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ConfigService } from '@nestjs/config';
import { ServiceInvoice } from './entities/service-invoice.entity';
import { Contract } from '../contract/entities/contract.entity';
import { CreateServiceInvoiceDto } from './dto/create-service-invoice.dto';
import { UpdateServiceInvoiceDto } from './dto/update-service-invoice.dto';
import { ProcessInvoiceResponseDto } from './dto/process-invoice.dto';
import { ServiceInvoiceStatusEnum } from '../common/enums/service-invoice-status.enum';

@Injectable()
export class ServiceInvoiceService {
  private documentAIClient: DocumentProcessorServiceClient | null;
  private processorId: string | undefined;

  constructor(
    @InjectRepository(ServiceInvoice)
    private serviceInvoiceRepository: Repository<ServiceInvoice>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private configService: ConfigService,
  ) {
    // Khởi tạo Google Document AI client với cấu hình an toàn
    const keyFilename = this.configService.get<string>('GOOGLE_CLOUD_KEY_FILE');
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    
    if (keyFilename && projectId) {
      try {
        this.documentAIClient = new DocumentProcessorServiceClient({
          keyFilename: keyFilename,
          projectId: projectId,
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

  async create(createServiceInvoiceDto: CreateServiceInvoiceDto): Promise<ServiceInvoice> {
    // Kiểm tra contract tồn tại
    const contract = await this.contractRepository.findOne({
      where: { id: createServiceInvoiceDto.contractId },
    });

    if (!contract) {
      throw new NotFoundException('Không tìm thấy hợp đồng');
    }

    // Tạo mã hóa đơn dịch vụ
    const invoiceCode = this.generateInvoiceCode(createServiceInvoiceDto.type);

    const serviceInvoice = this.serviceInvoiceRepository.create({
      ...createServiceInvoiceDto,
      contract,
      invoiceCode,
      dueDate: new Date(createServiceInvoiceDto.dueDate),
      invoiceDate: createServiceInvoiceDto.invoiceDate ? new Date(createServiceInvoiceDto.invoiceDate) : undefined,
    });

    return await this.serviceInvoiceRepository.save(serviceInvoice);
  }

  async findAll(): Promise<ServiceInvoice[]> {
    return await this.serviceInvoiceRepository.find({
      relations: ['contract', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ServiceInvoice> {
    const serviceInvoice = await this.serviceInvoiceRepository.findOne({
      where: { id },
      relations: ['contract', 'payment'],
    });

    if (!serviceInvoice) {
      throw new NotFoundException('Không tìm thấy hóa đơn dịch vụ');
    }

    return serviceInvoice;
  }

  async findByContract(contractId: string): Promise<ServiceInvoice[]> {
    return await this.serviceInvoiceRepository.find({
      where: { contract: { id: contractId } },
      relations: ['contract', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateServiceInvoiceDto: UpdateServiceInvoiceDto): Promise<ServiceInvoice> {
    const serviceInvoice = await this.findOne(id);

    if (updateServiceInvoiceDto.contractId) {
      const contract = await this.contractRepository.findOne({
        where: { id: updateServiceInvoiceDto.contractId },
      });
      if (!contract) {
        throw new NotFoundException('Không tìm thấy hợp đồng');
      }
      serviceInvoice.contract = contract;
    }

    const updatedFields = {
      ...updateServiceInvoiceDto,
      dueDate: updateServiceInvoiceDto.dueDate ? new Date(updateServiceInvoiceDto.dueDate) : serviceInvoice.dueDate,
      invoiceDate: updateServiceInvoiceDto.invoiceDate ? new Date(updateServiceInvoiceDto.invoiceDate) : serviceInvoice.invoiceDate,
    };

    Object.assign(serviceInvoice, updatedFields);
    return await this.serviceInvoiceRepository.save(serviceInvoice);
  }

  async remove(id: string): Promise<void> {
    const serviceInvoice = await this.findOne(id);
    
    if (serviceInvoice.status === ServiceInvoiceStatusEnum.PAID) {
      throw new BadRequestException('Không thể xóa hóa đơn đã thanh toán');
    }

    await this.serviceInvoiceRepository.remove(serviceInvoice);
  }

  async processInvoiceImage(imageBuffer: Buffer, mimeType: string): Promise<ProcessInvoiceResponseDto> {
    try {
      // Kiểm tra cấu hình Google Cloud
      if (!this.documentAIClient) {
        return this.createMockResponse('Google Document AI chưa được cấu hình. Sử dụng dữ liệu mẫu.');
      }

      if (!this.processorId) {
        return this.createMockResponse('Processor ID chưa được cấu hình. Sử dụng dữ liệu mẫu.');
      }

      // Kiểm tra project ID format
      const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
      if (!projectId || !this.isValidProjectId(projectId)) {
        return this.createMockResponse('Project ID không hợp lệ. Sử dụng dữ liệu mẫu.');
      }

      const encodedImage = imageBuffer.toString('base64');

      // Thử gọi Google Document AI
      const [result] = await this.documentAIClient.processDocument({
        name: this.processorId,
        rawDocument: {
          content: encodedImage,
          mimeType: mimeType,
        },
      });

      const entities = result.document?.entities || [];

      const extractedData = entities.map(entity => ({
        name: entity.type || 'unknown',
        value: entity.mentionText || entity.normalizedValue?.text || 'N/A',
        confidence: entity.confidence || 0,
      }));

      return {
        status: 'success',
        message: 'Xử lý hóa đơn thành công',
        extractedData,
        rawData: result.document,
      };

    } catch (error) {
      console.error('Lỗi khi xử lý hóa đơn với Google Document AI:', error);
      
      // Trả về dữ liệu mẫu thay vì lỗi
      return this.createMockResponse(
        `Google Document AI không khả dụng (${(error as Error).message}). Sử dụng dữ liệu mẫu.`
      );
    }
  }

  /**
   * Tạo response mẫu khi Google Document AI không khả dụng
   */
  private createMockResponse(message: string): ProcessInvoiceResponseDto {
    return {
      status: 'mock',
      message: message,
      extractedData: [
        { name: 'provider_name', value: 'Công ty điện lực TP.HCM', confidence: 0.95 },
        { name: 'invoice_number', value: 'EVN-2025-001234', confidence: 0.90 },
        { name: 'invoice_date', value: '2025-01-15', confidence: 0.88 },
        { name: 'total_amount', value: '850000', confidence: 0.92 },
        { name: 'consumption', value: '450', confidence: 0.85 },
        { name: 'unit', value: 'kWh', confidence: 0.90 },
        { name: 'unit_price', value: '1889', confidence: 0.87 },
        { name: 'service_type', value: 'ELECTRICITY', confidence: 0.95 },
      ],
      rawData: {
        mockData: true,
        note: 'Đây là dữ liệu mẫu do Google Document AI chưa được cấu hình đúng cách',
      },
    };
  }

  /**
   * Kiểm tra tính hợp lệ của Google Cloud Project ID
   */
  private isValidProjectId(projectId: string): boolean {
    // Project ID phải có độ dài 6-30 ký tự, chỉ chứa chữ thường, số và dấu gạch ngang
    const projectIdRegex = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
    return projectIdRegex.test(projectId);
  }

  async markAsPaid(id: string): Promise<ServiceInvoice> {
    const serviceInvoice = await this.findOne(id);
    serviceInvoice.status = ServiceInvoiceStatusEnum.PAID;
    return await this.serviceInvoiceRepository.save(serviceInvoice);
  }

  async markAsOverdue(id: string): Promise<ServiceInvoice> {
    const serviceInvoice = await this.findOne(id);
    serviceInvoice.status = ServiceInvoiceStatusEnum.OVERDUE;
    return await this.serviceInvoiceRepository.save(serviceInvoice);
  }

  private generateInvoiceCode(type: string): string {
    const prefix = this.getInvoicePrefix(type);
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  private getInvoicePrefix(type: string): string {
    const prefixMap: Record<string, string> = {
      ELECTRICITY: 'ELEC',
      WATER: 'WATR',
      PARKING: 'PARK',
      INTERNET: 'INET',
      CLEANING: 'CLEN',
      SECURITY: 'SECU',
      MAINTENANCE: 'MAIN',
      OTHER: 'OTHR',
    };
    return prefixMap[type] || 'SERV';
  }
}