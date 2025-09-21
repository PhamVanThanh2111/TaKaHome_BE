import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { VerificationTypeEnum } from '../../common/enums/verification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';

@Entity()
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'enum', enum: VerificationTypeEnum })
  type: VerificationTypeEnum;

  @Column()
  documentUrl: string;

  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.PENDING })
  status: StatusEnum;

  @ManyToOne(() => User, { nullable: true })
  verifiedBy: User;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
