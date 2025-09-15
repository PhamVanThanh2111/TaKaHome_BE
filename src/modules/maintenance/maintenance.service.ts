import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceTicket,
  MaintenanceStatus,
} from './entities/maintenance-ticket.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private readonly ticketRepo: Repository<MaintenanceTicket>,
  ) {}

  createTicket(bookingId: string, description: string) {
    const ticket = this.ticketRepo.create({
      booking: { id: bookingId },
      description,
    });
    return this.ticketRepo.save(ticket);
  }

  resolve(id: string) {
    return this.updateStatus(id, MaintenanceStatus.RESOLVED);
  }

  dispute(id: string) {
    return this.updateStatus(id, MaintenanceStatus.DISPUTED);
  }

  private async updateStatus(id: string, status: MaintenanceStatus) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    return this.ticketRepo.save(ticket);
  }
}
