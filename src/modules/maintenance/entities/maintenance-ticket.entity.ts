import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';

export enum MaintenanceStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  DISPUTED = 'DISPUTED',
  CLOSED = 'CLOSED',
}

@Entity()
export class MaintenanceTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, (b) => b.maintenanceTickets)
  booking: Booking;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.OPEN,
  })
  status: MaintenanceStatus;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
