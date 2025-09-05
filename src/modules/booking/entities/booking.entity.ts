import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Property } from '../../property/entities/property.entity';
import { BookingStatus } from 'src/modules/common/enums/booking-status.enum';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.bookings)
  tenant: User;

  @ManyToOne(() => Property, (property) => property.bookings)
  property: Property;

  @Column({ type: 'date' })
  bookingDate: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_LANDLORD,
  })
  status: BookingStatus;

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
  firstRentPaidAt?: Date; // IPN thanh toán kỳ đầu thành công

  @Column({ type: 'timestamptz', nullable: true })
  handoverAt?: Date; // bàn giao

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt?: Date; // bắt đầu thời gian thuê

  @Column({ type: 'timestamptz', nullable: true })
  closedAt?: Date; // kết thúc/settled

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
