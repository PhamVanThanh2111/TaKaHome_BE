import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';

export type EscrowDirection = 'CREDIT' | 'DEBIT';
export type EscrowTxnType = 'DEPOSIT' | 'DEDUCTION' | 'REFUND' | 'ADJUSTMENT';
export type EscrowTxnStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

@Entity('escrow_transactions')
export class EscrowTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Escrow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @Column({ type: 'uuid' })
  @Index()
  escrowId: string;

  @Column({ type: 'varchar', length: 10 })
  direction: EscrowDirection;

  @Column({ type: 'varchar', length: 16 })
  type: EscrowTxnType;

  @Column({ type: 'bigint' })
  amount: string; // VND, lưu dạng chuỗi

  @Column({ type: 'varchar', length: 12, default: 'COMPLETED' })
  status: EscrowTxnStatus;

  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
