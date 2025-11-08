import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { User } from '../../user/entities/user.entity';

export enum TerminationRequestStatus {
  PENDING = 'PENDING', // Chờ bên còn lại phê duyệt
  APPROVED = 'APPROVED', // Đã được phê duyệt
  REJECTED = 'REJECTED', // Bị từ chối
  CANCELLED = 'CANCELLED', // Người yêu cầu hủy yêu cầu
  EXPIRED = 'EXPIRED', // Hết hạn (không được phê duyệt trong thời gian quy định)
}

export enum TerminationRequestedBy {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
}

@Entity('contract_termination_requests')
export class ContractTerminationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column({ type: 'uuid' })
  contractId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column({ type: 'uuid' })
  requestedById: string;

  @Column({
    type: 'enum',
    enum: TerminationRequestedBy,
  })
  requestedByRole: TerminationRequestedBy;

  @Column({ type: 'text', nullable: true })
  reason: string;

  // Tháng/năm mà người yêu cầu muốn kết thúc hợp đồng (ví dụ: '2025-07')
  // Format: YYYY-MM
  // Tháng thanh toán cuối cùng sẽ luôn là tháng trước requestedEndMonth
  @Column({ type: 'varchar', length: 7 })
  requestedEndMonth: string;

  @Column({
    type: 'enum',
    enum: TerminationRequestStatus,
    default: TerminationRequestStatus.PENDING,
  })
  status: TerminationRequestStatus;

  // Người phê duyệt (bên còn lại)
  @Column({ type: 'uuid', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  // Thời gian phê duyệt/từ chối
  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date;

  @Column({ type: 'text', nullable: true })
  responseNote: string;

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
