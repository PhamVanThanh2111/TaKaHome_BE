/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { set } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { Contract } from '../contract/entities/contract.entity';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';
import { InvoiceService } from './invoice.service';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { VN_TZ, formatVN, vnNow } from '../../common/datetime';

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

  async generateMonthly(): Promise<ResponseCommon<null>> {
    const todayUtc = vnNow();
    const todayInVn = utcToZonedTime(todayUtc, VN_TZ);
    if (todayInVn.getDate() !== 1) {
      return new ResponseCommon(200, 'SKIPPED', null);
    }
    const contracts = await this.contractRepo.find({
      where: { status: ContractStatusEnum.ACTIVE },
      relations: ['property'],
    });
    for (const c of contracts) {
      await this.invoiceService.create({
        contractId: c.id,
        dueDate: formatVN(
          zonedTimeToUtc(
            set(todayInVn, {
              date: utcToZonedTime(c.startDate, VN_TZ).getDate(),
              hours: 0,
              minutes: 0,
              seconds: 0,
              milliseconds: 0,
            }),
            VN_TZ,
          ),
          'yyyy-MM-dd',
        ),
        items: [
          {
            description: 'Monthly rent',
            amount: c.property.price,
          },
        ],
      });
    }
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
