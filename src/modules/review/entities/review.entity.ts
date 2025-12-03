import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Property } from '../../property/entities/property.entity';
import { RoomType } from 'src/modules/property/entities/room-type.entity';

@Entity()
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reviews)
  reviewer: User;

  @ManyToOne(() => Property, (property) => property.reviews)
  property: Property;

  @ManyToOne(() => RoomType, (roomType) => roomType.reviews)
  roomType: RoomType;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'float' })
  rating: number;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
