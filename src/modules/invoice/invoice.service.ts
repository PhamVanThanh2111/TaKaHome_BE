import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceStatusEnum } from '../common/enums/invoice-status.enum';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepository: Repository<InvoiceItem>,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
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
    return this.invoiceRepository.save(invoice);
  }

  findAll(): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      relations: ['items', 'contract', 'payments'],
    });
  }

  findOne(id: string): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({
      where: { id },
      relations: ['items', 'contract', 'payments'],
    });
  }

  findByContract(contractId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { contract: { id: contractId } },
      relations: ['items', 'contract', 'payments'],
    });
  }

  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    if (!invoice) throw new Error(`Invoice with id ${id} not found`);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.PAID;
    return this.invoiceRepository.save(invoice);
  }

  async cancel(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    if (!invoice) throw new Error(`Invoice with id ${id} not found`);
    this.ensureStatus(invoice, [InvoiceStatusEnum.PENDING]);
    invoice.status = InvoiceStatusEnum.CANCELLED;
    return this.invoiceRepository.save(invoice);
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
}
