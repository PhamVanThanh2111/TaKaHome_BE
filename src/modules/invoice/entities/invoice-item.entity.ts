import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Invoice } from './invoice.entity';
import { ServiceTypeEnum } from '../../common/enums/service-type.enum';
@Entity()
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  invoice: Invoice;

  @Column()
  description: string;

  @Column()
  amount: number;

  @Column({
    type: 'enum',
    enum: ServiceTypeEnum,
    nullable: true,
  })
  serviceType?: ServiceTypeEnum;
}
