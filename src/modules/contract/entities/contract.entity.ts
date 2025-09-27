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
import { ContractStatusEnum } from '../../common/enums/contract-status.enum';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  contractCode: string;

  @ManyToOne(() => User, (user) => user.tenantContracts)
  tenant: User;

  @ManyToOne(() => User, (user) => user.landlordContracts)
  landlord: User;

  @ManyToOne(() => Property, (property) => property.contracts)
  property: Property;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ContractStatusEnum,
    default: ContractStatusEnum.PENDING_SIGNATURE,
  })
  status: ContractStatusEnum;

  @Column({ nullable: true })
  contractFileUrl: string;

  @Column({ nullable: true })
  blockchainTxHash: string;

  @Column({ nullable: true })
  smartContractAddress: string;

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
