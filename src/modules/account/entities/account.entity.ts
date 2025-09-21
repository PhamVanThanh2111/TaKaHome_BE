import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { RoleEnum } from 'src/modules/common/enums/role.enum';

@Entity()
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @OneToOne(() => User, (user) => user.account, { cascade: true })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: RoleEnum, array: true })
  roles: RoleEnum[];
}
