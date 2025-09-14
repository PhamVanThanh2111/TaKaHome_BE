import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export type WalletDirection = 'CREDIT' | 'DEBIT';
export type WalletTxnType =
  | 'TOPUP'
  | 'CONTRACT_PAYMENT'
  | 'REFUND'
  | 'ADJUSTMENT';
export type WalletTxnStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  wallet: Wallet;

  @Column({ type: 'uuid' })
  @Index()
  walletId: string;

  @Column({ type: 'varchar', length: 10 })
  direction: WalletDirection;

  @Column({ type: 'varchar', length: 24 })
  type: WalletTxnType;

  @Column({ type: 'bigint' })
  amount: string; // đơn vị: VND

  @Column({ type: 'varchar', length: 12, default: 'COMPLETED' })
  status: WalletTxnStatus;

  // tham chiếu nghiệp vụ (Payment/Contract/Topup…)
  @Column({ type: 'varchar', length: 24, nullable: true })
  refType: 'TOPUP' | 'PAYMENT' | 'CONTRACT';

  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  // metadata cổng thanh toán (khi topup)
  @Column({ type: 'varchar', length: 24, nullable: true })
  gateway: 'VNPAY' | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  gatewayTxnRef: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
