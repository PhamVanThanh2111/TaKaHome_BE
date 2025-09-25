import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escrow, EscrowBalanceParty } from './entities/escrow.entity';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatusEnum } from '../common/enums/payment-status.enum';
import { PaymentPurpose } from '../common/enums/payment-purpose.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { vnNow } from '../../common/datetime';
import { WalletService } from '../wallet/wallet.service';
import { WalletTxnType } from '../common/enums/wallet-txn-type.enum';

type EscrowBalanceResponse = {
  accountId: string;
  balanceTenant: string;
  balanceLandlord: string;
};

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
    private readonly walletService: WalletService,
  ) {}

  /** Tạo hoặc lấy Escrow cho 1 hợp đồng */
  async ensureAccountForContract(
    contractId: string,
  ): Promise<ResponseCommon<Escrow>> {
    let acc = await this.accountRepo.findOne({ where: { contractId } });
    if (acc) return new ResponseCommon(200, 'SUCCESS', acc);

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
      currentBalanceTenant: '0',
      currentBalanceLandlord: '0',
      currency: 'VND',
    });
    const saved = await this.accountRepo.save(acc);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  /** Ghi có tiền cọc khi Payment purpose=ESCROW_DEPOSIT đã PAID */
  async creditDepositFromPayment(
    paymentId: string,
  ): Promise<ResponseCommon<EscrowBalanceResponse>> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['contract'],
    });
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatusEnum.PAID)
      throw new Error('Payment is not PAID');
    if (
      payment.purpose !== PaymentPurpose.TENANT_ESCROW_DEPOSIT &&
      payment.purpose !== PaymentPurpose.LANDLORD_ESCROW_DEPOSIT
    )
      throw new Error('Payment is not a deposit');

    if (!payment.contract) throw new Error('Payment contract is undefined');
    const ensured = await this.ensureAccountForContract(payment.contract.id);
    const acc = ensured.data;
    if (!acc) throw new Error('Escrow account could not be ensured');

    const amount = BigInt(payment.amount);
    const isTenantDeposit =
      payment.purpose === PaymentPurpose.TENANT_ESCROW_DEPOSIT;
    const current = isTenantDeposit
      ? BigInt(acc.currentBalanceTenant || '0')
      : BigInt(acc.currentBalanceLandlord || '0');

    const txn = this.txnRepo.create({
      escrow: { id: acc.id },
      escrowId: acc.id,
      direction: 'CREDIT',
      type: 'DEPOSIT',
      amount: amount.toString(),
      status: 'COMPLETED',
      refType: 'PAYMENT',
      refId: payment.id,
      note: isTenantDeposit
        ? 'Tenant deposit funded via payment'
        : 'Landlord deposit funded via payment',
      completedAt: vnNow(),
    });
    await this.txnRepo.save(txn);

    const next = (current + amount).toString();
    if (isTenantDeposit) {
      acc.currentBalanceTenant = next;
    } else {
      acc.currentBalanceLandlord = next;
    }
    const updated = await this.accountRepo.save(acc);

    return new ResponseCommon(200, 'SUCCESS', {
      accountId: updated.id,
      balanceTenant: updated.currentBalanceTenant,
      balanceLandlord: updated.currentBalanceLandlord,
    });
  }

  /** Trừ tiền cọc (khấu trừ hư hại) */
  async deduct(
    accountId: string,
    amountVnd: number,
    party: EscrowBalanceParty,
    note?: string,
  ): Promise<ResponseCommon<Escrow>> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) throw new Error('Escrow not found');
    const amount = BigInt(amountVnd);
    const current =
      party === 'TENANT'
        ? BigInt(acc.currentBalanceTenant || '0')
        : BigInt(acc.currentBalanceLandlord || '0');
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
      note:
        note ??
        (party === 'TENANT'
          ? 'Deduction from tenant escrow'
          : 'Deduction from landlord escrow'),
      completedAt: vnNow(),
    });
    await this.txnRepo.save(txn);
    if (party === 'TENANT') {
      acc.currentBalanceTenant = next.toString();
    } else {
      acc.currentBalanceLandlord = next.toString();
    }

    // userId của bên nhận tiền (bên còn lại)
    const counterpartyUserId =
      party === 'TENANT' ? acc.contract?.landlord?.id : acc.tenantId;
    if (!counterpartyUserId)
      throw new Error('Counterparty wallet information missing');

    const saved = await this.accountRepo.save(acc);

    await this.walletService.credit(counterpartyUserId, {
      amount: amountVnd,
      type: WalletTxnType.REFUND,
      refId: acc.contractId,
      note:
        note ??
        (party === 'TENANT'
          ? 'Compensation received from tenant escrow'
          : 'Compensation received from landlord escrow'),
    });

    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  /** Hoàn ký quỹ (từ số dư escrow) */
  async refund(
    accountId: string,
    amountVnd: number,
    party: EscrowBalanceParty,
    note?: string,
  ): Promise<ResponseCommon<Escrow>> {
    const acc = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!acc) throw new Error('Escrow not found');
    const amount = BigInt(amountVnd);
    const current =
      party === 'TENANT'
        ? BigInt(acc.currentBalanceTenant || '0')
        : BigInt(acc.currentBalanceLandlord || '0');
    const next = current - amount;
    if (next < BigInt(0)) throw new Error('Insufficient escrow balance');

    // 1. Ghi giao dịch escrow
    const txn = this.txnRepo.create({
      escrow: { id: acc.id },
      escrowId: acc.id,
      direction: 'DEBIT',
      type: 'REFUND',
      amount: amount.toString(),
      status: 'COMPLETED',
      refType: 'ADJUSTMENT',
      refId: null,
      note:
        note ??
        (party === 'TENANT'
          ? 'Refund to tenant from escrow'
          : 'Refund to landlord from escrow'),
      completedAt: vnNow(),
    });
    await this.txnRepo.save(txn);

    // 2. Cập nhật số dư escrow
    if (party === 'TENANT') {
      acc.currentBalanceTenant = next.toString();
    } else {
      acc.currentBalanceLandlord = next.toString();
    }
    const saved = await this.accountRepo.save(acc);

    // 3. Hoàn tiền vào ví
    const partyUserId =
      party === 'TENANT' ? acc.tenantId : acc.contract?.landlord?.id;
    await this.walletService.credit(partyUserId, {
      amount: amountVnd,
      type: WalletTxnType.REFUND,
      refId: acc.id,
      note: 'Compensation received from escrow',
    });

    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  /** Lấy số dư cọc hiện tại theo tenant + property */
  async getBalanceByTenantAndProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<
    ResponseCommon<
      | EscrowBalanceResponse
      | { accountId: null; balanceTenant: string; balanceLandlord: string }
    >
  > {
    const acc = await this.accountRepo
      .createQueryBuilder('ea')
      .innerJoinAndSelect('ea.contract', 'c')
      .where('ea.tenantId = :tenantId', { tenantId })
      .andWhere('ea.propertyId = :propertyId', { propertyId })
      .orderBy('c.createdAt', 'DESC')
      .getOne();

    if (!acc)
      return new ResponseCommon(200, 'SUCCESS', {
        balanceTenant: '0',
        balanceLandlord: '0',
        accountId: null,
      });
    return new ResponseCommon(200, 'SUCCESS', {
      balanceTenant: acc.currentBalanceTenant,
      balanceLandlord: acc.currentBalanceLandlord,
      accountId: acc.id,
    });
  }
}
