import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceCronService implements OnModuleInit {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    private readonly invoiceService: InvoiceService,
  ) {}

  onModuleInit() {
    setInterval(
      () => {
        this.generateMonthly().catch((err) => {
          console.error('Error in generateMonthly:', err);
        });
      },
      24 * 60 * 60 * 1000,
    );
  }

  async generateMonthly() {
    const today = new Date();
    if (today.getDate() !== 1) return;
    const contracts = await this.contractRepo.find({
      where: { status: ContractStatusEnum.ACTIVE },
      relations: ['property'],
    });
    for (const c of contracts) {
      await this.invoiceService.create({
        contractId: c.id,
        dueDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          c.startDate.getDate(),
        ).toISOString(),
        items: [
          {
            description: 'Monthly rent',
            amount: c.property.price,
          },
        ],
      });
    }
  }
}
