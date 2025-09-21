import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { Review } from '../../review/entities/review.entity';
import { Favorite } from '../../favorite/entities/favorite.entity';
import { Report } from '../../report/entities/report.entity';
import { Account } from 'src/modules/account/entities/account.entity';
import { UserStatusEnum } from '../../common/enums/user-status.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ name: 'full_name', length: 100, nullable: true })
  fullName: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({
    type: 'enum',
    enum: UserStatusEnum,
    default: UserStatusEnum.ACTIVE,
  })
  status: UserStatusEnum;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateAt: Date;

  // Relations
  @OneToMany(() => Booking, (booking) => booking.tenant)
  bookings: Booking[];

  @OneToMany(() => Contract, (contract) => contract.tenant)
  tenantContracts: Contract[];

  @OneToMany(() => Contract, (contract) => contract.landlord)
  landlordContracts: Contract[];

  @OneToMany(() => Review, (review) => review.reviewer)
  reviews: Review[];

  @OneToMany(() => Favorite, (favorite) => favorite.user)
  favorites: Favorite[];

  @OneToMany(() => Report, (report) => report.reporter)
  reports: Report[];

  @OneToOne(() => Account, (account) => account.user)
  account: Account;
}
