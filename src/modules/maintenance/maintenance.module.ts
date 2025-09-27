import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceTicket } from './entities/maintenance-ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceTicket])],
  providers: [MaintenanceService],
  exports: [MaintenanceService, TypeOrmModule],
})
export class MaintenanceModule {}
