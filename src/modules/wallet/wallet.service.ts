import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletCreditDto } from './dto/wallet-credit.dto';
import { WalletDebitDto } from './dto/wallet-debit.dto';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Wallet } from './entities/wallet.entity';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { vnNow } from '../../common/datetime';
import { WalletDirection } from '../common/enums/wallet-txn-direction.enum';
import { WalletTxnStatus } from '../common/enums/wallet-txn-status.enum';

@Injectable()
export class WalletService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txnRepo: Repository<WalletTransaction>,
  ) {}

  /** Tạo ví nếu chưa có, trả về ví */
  async ensureWallet(userId: string): Promise<ResponseCommon<Wallet>> {
    const wallet = await this.ensureWalletEntity(userId);
    return new ResponseCommon(200, 'SUCCESS', wallet);
  }

  async getMyWallet(userId: string): Promise<
    ResponseCommon<{
      walletId: string;
      availableBalance: number;
      currency: string;
      updatedAt: Date;
    }>
  > {
    const wallet = await this.ensureWalletEntity(userId);
    return new ResponseCommon(200, 'SUCCESS', {
      walletId: wallet.id,
      availableBalance: Number(wallet.availableBalance),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    });
  }

  /** Nạp / hoàn / điều chỉnh số dư (ghi CREDIT) */
  async credit(
    userId: string,
    dto: WalletCreditDto,
  ): Promise<
    ResponseCommon<{ walletId: string; balance: number; txnId: string }>
  > {
    const { amount, type, refId, note } = dto;
    if (amount <= 0) throw new BadRequestException('Amount must be > 0');

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      // lock hàng ví (FOR UPDATE)
      let wallet = await runner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        wallet = runner.manager.create(Wallet, {
          userId,
          availableBalance: '0',
          currency: 'VND',
        });
        wallet = await runner.manager.save(wallet);
      }

      const cur = BigInt(wallet.availableBalance);
      const amt = BigInt(amount);
      wallet.availableBalance = (cur + amt).toString();
      wallet.updatedAt = vnNow();
      await runner.manager.save(wallet);

      const txn = runner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        direction: WalletDirection.CREDIT,
        type,
        amount: amount.toString(),
        status: WalletTxnStatus.COMPLETED,
        ...(refId !== undefined && refId !== null ? { refId } : {}),
        ...(note !== undefined && note !== null ? { note } : {}),
        completedAt: vnNow(),
      });
      await runner.manager.save(txn);

      await runner.commitTransaction();
      return new ResponseCommon(200, 'SUCCESS', {
        walletId: wallet.id,
        balance: Number(wallet.availableBalance),
        txnId: txn.id,
      });
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  /** Trừ tiền ví để thanh toán hợp đồng (ghi DEBIT) */
  async debit(
    userId: string,
    dto: WalletDebitDto,
  ): Promise<
    ResponseCommon<{ walletId: string; balance: number; txnId: string }>
  > {
    const { amount, type, refId, note } = dto;
    if (amount <= 0) throw new BadRequestException('Amount must be > 0');

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      // lock ví
      const wallet = await runner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const cur = BigInt(wallet.availableBalance);
      const amt = BigInt(amount);
      if (cur < amt) throw new BadRequestException('Insufficient balance');

      wallet.availableBalance = (cur - amt).toString();
      wallet.updatedAt = vnNow();
      await runner.manager.save(wallet);

      const txn = runner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        direction: WalletDirection.DEBIT,
        type, // CONTRACT_PAYMENT
        amount: amount.toString(),
        status: WalletTxnStatus.COMPLETED,
        refId,
        note: note ?? null,
        completedAt: vnNow(),
      });
      await runner.manager.save(txn);

      await runner.commitTransaction();
      return new ResponseCommon(200, 'SUCCESS', {
        walletId: wallet.id,
        balance: Number(wallet.availableBalance),
        txnId: txn.id,
      });
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  /** Lấy lịch sử giao dịch ví của user */
  async getTransactionHistory(
    userId: string,
  ): Promise<ResponseCommon<WalletTransaction[]>> {
    // Đảm bảo user có ví
    const wallet = await this.ensureWalletEntity(userId);
    
    // Lấy danh sách transactions
    const transactions = await this.txnRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', transactions);
  }

  // --- HELPER ---

  private async ensureWalletEntity(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        availableBalance: '0',
        currency: 'VND',
      });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }
}
