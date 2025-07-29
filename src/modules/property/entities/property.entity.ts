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
import { StatusEnum } from '../../common/enums/status.enum';
import { PropertyImage } from '../../property-image/entities/property-image.entity';
import { PropertyUtility } from '../../property-utility/entities/property-utility.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { Review } from '../../review/entities/review.entity';
import { Favorite } from '../../favorite/entities/favorite.entity';
import { Report } from '../../report/entities/report.entity';

@Entity()
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  address: string;

  @Column({
    type: 'enum',
    enum: PropertyTypeEnum,
    default: PropertyTypeEnum.HOUSE,
  })
  type: PropertyTypeEnum;

  @Column()
  price: number;

  @Column({ nullable: true })
  area: number;

  @Column({ nullable: true })
  bedrooms: number;

  @Column({ nullable: true })
  bathrooms: number;

  @Column({ nullable: true })
  mapLocation: string;

  @Column({ default: true })
  isVisible: boolean;

  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.ACTIVE })
  status: StatusEnum;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.id)
  landlord: User;

  @OneToMany(() => PropertyImage, (img) => img.property)
  images: PropertyImage[];

  @OneToMany(() => PropertyUtility, (util) => util.property)
  utilities: PropertyUtility[];

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
}
