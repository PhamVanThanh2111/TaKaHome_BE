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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  area: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
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
