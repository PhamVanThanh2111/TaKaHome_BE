import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';

@Entity('penalty_records')
export class PenaltyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  contract: Contract;

  @Column({ type: 'uuid' })
  @Index()
  contractId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  penaltyType: 'OVERDUE_PAYMENT' | 'MONTHLY_PAYMENT' | 'LATE_DEPOSIT' | 'OTHER';

  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index()
  period?: string; // For monthly payments: "2", "3", "4"

  @Column({ type: 'date' })
  @Index()
  overdueDate: Date; // The date when payment became overdue

  @Column({ type: 'int' })
  daysPastDue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  originalAmount: number; // Original payment amount

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  penaltyAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 3 })
  penaltyRate: number; // 0.03 for 0.03%

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 50 })
  status: 'APPLIED' | 'WAIVED' | 'DISPUTED' | 'REVERSED';

  @Column({ type: 'varchar', length: 200, nullable: true })
  blockchainTxHash?: string;

  @Column({ type: 'timestamptz' })
  appliedAt: Date;

  @Column({ type: 'varchar', length: 100 })
  appliedBy: string; // 'system' or userId

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}