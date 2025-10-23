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
  AWAITING_SIGNATURES = 'AWAITING_SIGNATURES', // Tenant đã đồng ý với giá, chờ ký hợp đồng
  LANDLORD_SIGNED = 'LANDLORD_SIGNED', // Landlord đã ký, chờ tenant ký
  AWAITING_ESCROW = 'AWAITING_ESCROW', // Chờ đóng ký quỹ
  ESCROW_FUNDED_T = 'ESCROW_FUNDED_T',
  ESCROW_FUNDED_L = 'ESCROW_FUNDED_L',
  ACTIVE = 'ACTIVE', // Extension đã có hiệu lực
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

  // Ký hợp đồng gia hạn
  @Column({ nullable: true })
  extensionContractFileUrl?: string; // URL file hợp đồng gia hạn

  @Column({ nullable: true })
  landlordSignedAt?: Date; // Thời gian chủ nhà ký

  @Column({ nullable: true })
  tenantSignedAt?: Date; // Thời gian tenant ký

  @Column({ nullable: true })
  transactionIdLandlordSign?: string; // Transaction ID khi landlord ký

  @Column({ nullable: true })
  transactionIdTenantSign?: string; // Transaction ID khi tenant ký

  // Ký quỹ
  @Column({ nullable: true })
  escrowDepositDueAt?: Date; // Hạn đóng ký quỹ

  @Column({ nullable: true })
  tenantEscrowDepositFundedAt?: Date; // Thời gian tenant đóng ký quỹ

  @Column({ nullable: true })
  landlordEscrowDepositFundedAt?: Date; // Thời gian landlord đóng ký quỹ

  @Column({ nullable: true })
  activatedAt?: Date; // Thời gian extension có hiệu lực

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
