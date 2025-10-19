import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';

export enum ExtensionStatus {
  PENDING = 'PENDING', // Tenant vừa gửi yêu cầu gia hạn
  LANDLORD_RESPONDED = 'LANDLORD_RESPONDED', // Landlord đã phản hồi với giá mới, chờ tenant đồng ý
  APPROVED = 'APPROVED', // Tenant đã đồng ý với giá, extension được áp dụng
  REJECTED = 'REJECTED', // Landlord từ chối hoặc tenant không đồng ý với giá
  CANCELLED = 'CANCELLED', // Tenant hủy yêu cầu
}

@Entity('contract_extensions')
export class ContractExtension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @ManyToOne(() => Contract, (contract) => contract.extensions)
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column({ type: 'int' })
  extensionMonths: number; // Số tháng muốn gia hạn

  @Column({ nullable: true })
  newMonthlyRent?: number; // Giá thuê mới

  @Column({ nullable: true })
  newElectricityPrice?: number; // Giá điện mới (chỉ cho phòng trọ)

  @Column({ nullable: true })
  newWaterPrice?: number; // Giá nước mới (chỉ cho phòng trọ)

  @Column({ type: 'text', nullable: true })
  requestNote?: string; // Ghi chú từ người thuê

  @Column({ type: 'text', nullable: true })
  responseNote?: string; // Ghi chú phản hồi từ chủ nhà

  @Column({
    type: 'enum',
    enum: ExtensionStatus,
    default: ExtensionStatus.PENDING,
  })
  status: ExtensionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt?: Date; // Thời gian chủ nhà phản hồi

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
