import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';

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

  // ---- Helper methods ----
  generateCode() {
    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase(); // 4 kí tự
    return `INV-${yyyymmdd}-${rand}`;
  }
}
