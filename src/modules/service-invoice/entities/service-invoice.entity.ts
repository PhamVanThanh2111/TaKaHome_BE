import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { ServiceTypeEnum } from '../../common/enums/service-type.enum';
import { ServiceInvoiceStatusEnum } from '../../common/enums/service-invoice-status.enum';

@Entity()
export class ServiceInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceCode: string;

  @Column({
    type: 'enum',
    enum: ServiceTypeEnum,
  })
  type: ServiceTypeEnum;

  @ManyToOne(() => Contract, (contract) => contract.id)
  contract: Contract;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'timestamptz' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: ServiceInvoiceStatusEnum,
    default: ServiceInvoiceStatusEnum.PENDING,
  })
  status: ServiceInvoiceStatusEnum;

  @OneToOne(() => Payment, (payment) => payment.serviceInvoice, { nullable: true })
  @JoinColumn()
  payment?: Payment;

  // Thông tin chi tiết từ hóa đơn (nếu có)
  @Column({ nullable: true })
  providerName?: string; // Tên nhà cung cấp dịch vụ

  @Column({ nullable: true })
  providerAddress?: string; // Địa chỉ nhà cung cấp

  @Column({ nullable: true })
  invoiceNumber?: string; // Số hóa đơn gốc

  @Column({ type: 'timestamptz', nullable: true })
  invoiceDate?: Date; // Ngày lập hóa đơn gốc

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  consumption?: number; // Lượng tiêu thụ (kWh cho điện, m3 cho nước)

  @Column({ nullable: true })
  unit?: string; // Đơn vị (kWh, m3, tháng, etc.)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice?: number; // Đơn giá

  @Column({ type: 'text', nullable: true })
  description?: string; // Mô tả chi tiết

  @Column({ type: 'text', nullable: true })
  notes?: string; // Ghi chú

  // URL hình ảnh hóa đơn gốc
  @Column({ nullable: true })
  originalInvoiceImageUrl?: string;

  // Dữ liệu thô từ Google Document AI (JSON)
  @Column({ type: 'jsonb', nullable: true })
  extractedData?: any;

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