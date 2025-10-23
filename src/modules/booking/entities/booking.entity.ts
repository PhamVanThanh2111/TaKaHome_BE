import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Property } from '../../property/entities/property.entity';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';
import { Contract } from '../../contract/entities/contract.entity';
import { Room } from 'src/modules/property/entities/room.entity';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.bookings)
  tenant: User;

  @ManyToOne(() => Property, (property) => property.bookings)
  property: Property;

  @ManyToOne(() => Room, (room) => room.bookings)
  room: Room;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_LANDLORD,
  })
  status: BookingStatus;

  @Column({ type: 'uuid', nullable: true })
  contractId?: string;

  @OneToOne(() => Contract, { nullable: true })
  @JoinColumn()
  contract?: Contract;

  // Mốc thời gian nghiệp vụ
  @Column({ type: 'timestamptz', nullable: true })
  signedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  escrowDepositDueAt?: Date; // hạn nộp cọc (+24h sau SIGNED)

  @Column({ type: 'timestamptz', nullable: true })
  escrowDepositFundedAt?: Date; // IPN cọc thành công

  @Column({ type: 'timestamptz', nullable: true })
  firstRentDueAt?: Date; // hạn thanh toán kỳ đầu (+ 72h sau SIGNED)

  @Column({ type: 'timestamptz', nullable: true })
  landlordEscrowDepositDueAt?: Date; // hạn nộp ký quỹ chủ nhà

  @Column({ type: 'timestamptz', nullable: true })
  landlordEscrowDepositFundedAt?: Date; // Chủ nhà đã nộp ký quỹ

  @Column({ type: 'timestamptz', nullable: true })
  firstRentPaidAt?: Date; // IPN thanh toán kỳ đầu thành công

  @Column({ type: 'timestamptz', nullable: true })
  handoverAt?: Date; // bàn giao

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt?: Date; // bắt đầu thời gian thuê

  @Column({ type: 'timestamptz', nullable: true })
  closedAt?: Date; // kết thúc/settled

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
