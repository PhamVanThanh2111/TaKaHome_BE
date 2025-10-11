import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Property } from './property.entity';
import { RoomType } from './room-type.entity';
import { Booking } from 'src/modules/booking/entities/booking.entity';
import { Contract } from 'src/modules/contract/entities/contract.entity';
import { Favorite } from 'src/modules/favorite/entities/favorite.entity';
import { Review } from 'src/modules/review/entities/review.entity';
import { Report } from 'src/modules/report/entities/report.entity';

@Entity()
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Property, (property) => property.rooms)
  property: Property;

  @ManyToOne(() => RoomType, (roomType) => roomType.rooms)
  roomType: RoomType;

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];

  @OneToMany(() => Contract, (contract) => contract.room)
  contracts: Contract[];

  @OneToMany(() => Review, (review) => review.property)
  reviews: Review[];

  @OneToMany(() => Favorite, (favorite) => favorite.property)
  favorites: Favorite[];

  @OneToMany(() => Report, (report) => report.room)
  reports: Report[];

  @Column({ default: true })
  isVisible: boolean;

  @Column({ nullable: true })
  floor: number;

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
