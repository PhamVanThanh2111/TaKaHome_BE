import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PropertyTypeEnum } from '../../common/enums/property-type.enum';
import { Contract } from '../../contract/entities/contract.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { Review } from '../../review/entities/review.entity';
import { Favorite } from '../../favorite/entities/favorite.entity';
import { Report } from '../../report/entities/report.entity';
import { Room } from './room.entity';

@Entity()
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: PropertyTypeEnum,
    default: PropertyTypeEnum.HOUSING,
  })
  type: PropertyTypeEnum;

  @Column()
  province: string;

  @Column()
  ward: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  block?: string;

  @Column({ nullable: true })
  furnishing?: string;

  @Column({ nullable: true })
  legalDoc?: string;

  @Column({ nullable: true })
  legalUrl?: string;

  @Column({ nullable: true })
  price?: number;

  @Column({ nullable: true })
  deposit?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  electricityPricePerKwh?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  waterPricePerM3?: number;

  @Column({ nullable: true })
  area?: number;

  @Column({ nullable: true })
  bedrooms?: number;

  @Column({ nullable: true })
  bathrooms?: number;

  @Column({ nullable: true })
  mapLocation?: string;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ default: false })
  isVisible: boolean;

  @Column({ nullable: true })
  heroImage?: string;

  @Column('text', { array: true, nullable: true })
  images?: string[];

  @Column({ nullable: true })
  floor?: number;

  @ManyToOne(() => User, (user) => user.id)
  landlord: User;

  @OneToMany(() => Contract, (contract) => contract.property)
  contracts: Contract[];

  @OneToMany(() => Booking, (booking) => booking.property)
  bookings: Booking[];

  @OneToMany(() => Review, (review) => review.property)
  reviews: Review[];

  @OneToMany(() => Favorite, (favorite) => favorite.property)
  favorites: Favorite[];

  @OneToMany(() => Report, (report) => report.property)
  reports: Report[];

  // === BOARDING-SPECIFIC RELATIONSHIPS ===
  @OneToMany(() => Room, (room) => room.property)
  rooms: Room[];

  @Column({ nullable: true })
  unit?: string;

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
