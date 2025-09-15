import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escrow } from './entities/escrow.entity';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatusEnum } from '../common/enums/payment-status.enum';
import { PaymentPurpose } from '../common/enums/payment-purpose.enum';

@Injectable()
export class EscrowService {
  constructor(
    @InjectRepository(Escrow)
    private readonly accountRepo: Repository<Escrow>,
    @InjectRepository(EscrowTransaction)
    private readonly txnRepo: Repository<EscrowTransaction>,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /** Tạo hoặc lấy Escrow cho 1 hợp đồng */
  async ensureAccountForContract(contractId: string): Promise<Escrow> {
    let acc = await this.accountRepo.findOne({ where: { contractId } });
    if (acc) return acc;

    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['tenant', 'property'],
    });
    if (!contract) throw new Error('Contract not found');

    acc = this.accountRepo.create({
      contract: { id: contractId },
      contractId,
      tenant: { id: contract.tenant.id },
      tenantId: contract.tenant.id,
      property: { id: contract.property.id },
      propertyId: contract.property.id,
      currentBalance: '0',
      currency: 'VND',
    });
    return this.accountRepo.save(acc);
  }

  /** Ghi có tiền cọc khi Payment purpose=ESCROW_DEPOSIT đã PAID */
  async creditDepositFromPayment(paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['contract'],
    });
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatusEnum.PAID)
      throw new Error('Payment is not PAID');
    if (
      payment.purpose !== PaymentPurpose.ESCROW_DEPOSIT &&
      payment.purpose !== PaymentPurpose.OWNER_ESCROW_DEPOSIT
    )
      throw new Error('Payment is not a deposit');

    const acc = await this.ensureAccountForContract(payment.contract.id);

    const amount = BigInt(payment.amount);
    const current = BigInt(acc.currentBalance || '0');

    const txn = this.txnRepo.create({
      escrow: { id: acc.id },
      escrowId: acc.id,
      direction: 'CREDIT',
      type: 'DEPOSIT',
      amount: amount.toString(),
      status: 'COMPLETED',
      refType: 'PAYMENT',
      refId: payment.id,
      note:
        payment.purpose === PaymentPurpose.OWNER_ESCROW_DEPOSIT
          ? 'Owner deposit funded via payment'
          : 'Deposit funded via payment',
      completedAt: new Date(),
    });
    await this.txnRepo.save(txn);

    acc.currentBalance = (current + amount).toString();
    await this.accountRepo.save(acc);

    return { accountId: acc.id, balance: acc.currentBalance };
  }

  /** Trừ tiền cọc (khấu trừ hư hại) */
  async deduct(
    accountId: string,
    amountVnd: number,
    note?: string,
  ): Promise<Escrow> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) throw new Error('Escrow not found');
    const amount = BigInt(amountVnd);
    const current = BigInt(acc.currentBalance || '0');
    const next = current - amount;
    if (next < BigInt(0)) throw new Error('Insufficient escrow balance');

    const txn = this.txnRepo.create({
      escrow: { id: acc.id },
      escrowId: acc.id,
      direction: 'DEBIT',
      type: 'DEDUCTION',
      amount: amount.toString(),
      status: 'COMPLETED',
      refType: 'SETTLEMENT',
      refId: null,
      note: note ?? 'Deduction',
      completedAt: new Date(),
    });
    await this.txnRepo.save(txn);
    acc.currentBalance = next.toString();
    return this.accountRepo.save(acc);
  }

  /** Hoàn cọc lại cho người thuê (từ số dư escrow) */
  async refund(
    accountId: string,
    amountVnd: number,
    note?: string,
  ): Promise<Escrow> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) throw new Error('Escrow not found');
    const amount = BigInt(amountVnd);
    const current = BigInt(acc.currentBalance || '0');
    const next = current - amount;
    if (next < BigInt(0)) throw new Error('Insufficient escrow balance');

    const txn = this.txnRepo.create({
      escrow: { id: acc.id },
      escrowId: acc.id,
      direction: 'DEBIT',
      type: 'REFUND',
      amount: amount.toString(),
      status: 'COMPLETED',
      refType: 'ADJUSTMENT',
      refId: null,
      note: note ?? 'Refund to tenant',
      completedAt: new Date(),
    });
    await this.txnRepo.save(txn);
    acc.currentBalance = next.toString();
    return this.accountRepo.save(acc);
  }

  /** Lấy số dư cọc hiện tại theo tenant + property */
  async getBalanceByTenantAndProperty(tenantId: string, propertyId: string) {
    const acc = await this.accountRepo
      .createQueryBuilder('ea')
      .innerJoinAndSelect('ea.contract', 'c')
      .where('ea.tenantId = :tenantId', { tenantId })
      .andWhere('ea.propertyId = :propertyId', { propertyId })
      .orderBy('c.createdAt', 'DESC')
      .getOne();

    if (!acc) return { balance: '0', accountId: null };
    return { balance: acc.currentBalance, accountId: acc.id };
  }
}
