import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'certificate_key' })
export class CertificateKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'text', name: 'private_key_encrypted' })
  privateKeyEncrypted: string;

  @Column({ type: 'text', name: 'certificate_pem' })
  certificatePem: string;

  @Column({ type: 'varchar', length: 255, name: 'serial_number', nullable: true })
  serialNumber: string | null;

  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', name: 'revoked', default: false })
  revoked: boolean;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
