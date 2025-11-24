import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Property } from '../../property/entities/property.entity';
import { RoomType } from 'src/modules/property/entities/room-type.entity';

@Entity()
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.favorites)
  user: User;

  @ManyToOne(() => Property, (property) => property.favorites)
  property: Property;

  @ManyToOne(() => RoomType, (roomType) => roomType.favorites)
  roomType: RoomType;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
