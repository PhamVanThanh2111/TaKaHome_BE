import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { RoleEnum } from '../../common/enums/role.enum';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: RoleEnum,
    unique: true,
  })
  name: RoleEnum;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}
