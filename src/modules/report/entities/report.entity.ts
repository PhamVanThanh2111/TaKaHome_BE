import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Property } from '../../property/entities/property.entity';
import { Room } from 'src/modules/property/entities/room.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reports)
  reporter: User;

  @ManyToOne(() => Property, (property) => property.reports)
  property: Property;

  @ManyToOne(() => Room, (room) => room.reports)
  room: Room;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
