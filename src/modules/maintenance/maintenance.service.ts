import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceTicket,
  MaintenanceStatus,
} from './entities/maintenance-ticket.entity';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private readonly ticketRepo: Repository<MaintenanceTicket>,
  ) {}

  async createTicket(
    bookingId: string,
    description: string,
  ): Promise<ResponseCommon<MaintenanceTicket>> {
    const ticket = this.ticketRepo.create({
      booking: { id: bookingId },
      description,
    });
    const saved = await this.ticketRepo.save(ticket);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async resolve(id: string): Promise<ResponseCommon<MaintenanceTicket>> {
    const ticket = await this.updateStatus(id, MaintenanceStatus.RESOLVED);
    return new ResponseCommon(200, 'SUCCESS', ticket);
  }

  async dispute(id: string): Promise<ResponseCommon<MaintenanceTicket>> {
    const ticket = await this.updateStatus(id, MaintenanceStatus.DISPUTED);
    return new ResponseCommon(200, 'SUCCESS', ticket);
  }

  private async updateStatus(id: string, status: MaintenanceStatus) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    return this.ticketRepo.save(ticket);
  }
}
