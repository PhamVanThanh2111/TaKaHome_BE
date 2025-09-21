import { Contract } from 'src/modules/contract/entities/contract.entity';
import { Property } from 'src/modules/property/entities/property.entity';
import { User } from 'src/modules/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EscrowTransaction } from './escrow-transaction.entity';

@Entity('escrow_accounts')
@Unique(['contractId'])
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column({ type: 'uuid' })
  contractId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: User;

  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column({ type: 'uuid' })
  @Index()
  propertyId: string;

  // bigint trong DB – dùng string để đảm bảo chính xác
  @Column({ type: 'bigint', default: 0 })
  currentBalance: string;

  @Column({ type: 'varchar', length: 8, default: 'VND' })
  currency: string;

  @OneToMany(() => EscrowTransaction, (t) => t.escrow)
  transactions: EscrowTransaction[];

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
