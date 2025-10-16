import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Room } from './room.entity';

@Entity()
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 1 })
  bedrooms: number;

  @Column({ type: 'int', default: 1 })
  bathrooms: number;

  @Column({ nullable: true })
  area: number;

  @Column({ nullable: true })
  price: number;

  @Column({ nullable: true })
  deposit: number;

  @Column()
  furnishing: string;

  @Column('text', { array: true })
  images: string[];

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => Room, (room) => room.roomType)
  rooms?: Room[];

  @Column({ nullable: true })
  heroImage?: string;

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
