import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Property } from '../../property/entities/property.entity';

@Entity()
export class PropertyUtility {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Property, (property) => property.utilities)
  property: Property;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;
}
