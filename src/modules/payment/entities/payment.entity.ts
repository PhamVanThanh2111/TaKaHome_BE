import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { PaymentStatusEnum } from 'src/modules/common/enums/payment-status.enum';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contract, (contract) => contract.id)
  contract: Contract;

  @Column()
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethodEnum })
  method: PaymentMethodEnum;

  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  status: PaymentStatusEnum;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ########### BLOCKCHAIN ###########
  @Column({ nullable: true })
  gatewayTxnRef?: string;

  @Column({ nullable: true })
  transactionNo?: string;

  // ########### VNPAY ###########
  @Column({ nullable: true })
  bankCode: string;

  @Column({ nullable: true })
  paidAt: Date;
}
