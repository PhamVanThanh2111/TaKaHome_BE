import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Property } from '../../property/entities/property.entity';

@Entity()
export class PropertyImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Property, (property) => property.images)
  property: Property;

  @Column()
  imageUrl: string;
}
