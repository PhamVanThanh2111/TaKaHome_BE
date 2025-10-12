import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { WalletDirection } from 'src/modules/common/enums/wallet-txn-direction.enum';
import { WalletTxnType } from 'src/modules/common/enums/wallet-txn-type.enum';
import { WalletTxnStatus } from 'src/modules/common/enums/wallet-txn-status.enum';

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
  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  // metadata cổng thanh toán (khi topup)
  @Column({ type: 'varchar', length: 24, nullable: true })
  gateway: 'VNPAY' | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  gatewayTxnRef: string | null;

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
