import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { zonedTimeToUtc } from 'date-fns-tz';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceStatusEnum } from '../common/enums/invoice-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';

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
    const dueInput =
      dto.dueDate.length === 10 ? `${dto.dueDate}T00:00:00` : dto.dueDate;
    const invoice = this.invoiceRepository.create({
      invoiceCode: code,
      contract: { id: dto.contractId },
      dueDate: zonedTimeToUtc(dueInput, VN_TZ),
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

  async findOne(id: string): Promise<ResponseCommon<Invoice | null>> {
    const invoice = await this.loadInvoice(id);
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
}
