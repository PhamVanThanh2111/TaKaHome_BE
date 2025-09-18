import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceStatusEnum } from '../common/enums/invoice-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepository: Repository<InvoiceItem>,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<ResponseCommon<Invoice>> {
    const items = dto.items.map((i) => this.itemRepository.create(i));
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const code = this.generateCode();
    const invoice = this.invoiceRepository.create({
      invoiceCode: code,
      contract: { id: dto.contractId },
      dueDate: dto.dueDate,
      items,
      totalAmount: total,
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

  async findOne(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoiceOrFail(id);
    return new ResponseCommon(200, 'SUCCESS', invoice);
  }

  async findByContract(contractId: string): Promise<ResponseCommon<Invoice[]>> {
    const invoices = await this.invoiceRepository.find({
      where: { contract: { id: contractId } },
      relations: ['items', 'contract', 'payments'],
    });
    return new ResponseCommon(200, 'SUCCESS', invoices);
  }

  async markPaid(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoiceOrFail(id);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.PAID;
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async cancel(id: string): Promise<ResponseCommon<Invoice>> {
    const invoice = await this.loadInvoiceOrFail(id);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.CANCELLED;
    const saved = await this.invoiceRepository.save(invoice);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  // ---- Helper methods ----
  generateCode() {
    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
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

  private async loadInvoiceOrFail(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['items', 'contract', 'payments'],
    });
    if (!invoice) throw new Error(`Invoice with id ${id} not found`);
    return invoice;
  }
}
