/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ConfigType } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'querystring';
import vnpayConfig from 'src/config/vnpay.config';
import { PaymentStatusEnum } from '../common/enums/payment-status.enum';
import { PaymentMethodEnum } from '../common/enums/payment-method.enum';
import { WalletService } from '../wallet/wallet.service';
import { PaymentPurpose } from '../common/enums/payment-purpose.enum';
import { EscrowService } from '../escrow/escrow.service';
import { BookingService } from '../booking/booking.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ResponseCommon } from 'src/common/dto/response.dto';
import {
  addMinutesVN,
  formatVN,
  parseVnpPayDateToUtc,
  vnNow,
  vnpFormatYYYYMMDDHHmmss,
} from '../../common/datetime';
import { WalletTxnType } from '../common/enums/wallet-txn-type.enum';

@Injectable()
export class PaymentService {
  logger: any;
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(vnpayConfig.KEY)
    private readonly vnpay: ConfigType<typeof vnpayConfig>,
    private readonly walletService: WalletService,
    private readonly escrowService: EscrowService,
    private readonly bookingService: BookingService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /** API chính để khởi tạo thanh toán */
  async createPayment(
    dto: CreatePaymentDto,
    ctx: { userId: string; ipAddr: string },
  ): Promise<
    ResponseCommon<{
      id: string;
      contractId: string;
      amount: number;
      method: PaymentMethodEnum;
      status: PaymentStatusEnum;
      paymentUrl?: string;
      txnRef?: string;
    }>
  > {
    const { contractId, amount, method, purpose } = dto;

    // 1) Tạo bản ghi Payment PENDING (mặc định)
    let payment = this.paymentRepository.create({
      contract: { id: contractId },
      amount,
      method, // 'WALLET' | 'VNPAY'
      status: PaymentStatusEnum.PENDING, // PENDING khi tạo mới
      ...(purpose ? { purpose } : {}),
    });
    payment = await this.paymentRepository.save(payment);

    if (method === PaymentMethodEnum.WALLET) {
      // 2A) Thanh toán bằng ví: trừ ví và chuyển sang PAID
      await this.walletService.debit(ctx.userId, {
        amount,
        type: WalletTxnType.CONTRACT_PAYMENT,
        refId: payment.id,
        note: `Pay contract ${contractId} by wallet`,
      });

      payment.status = PaymentStatusEnum.PAID;
      payment.paidAt = vnNow();
      await this.paymentRepository.save(payment);

      await this.onPaymentPaid(payment.id);

      return new ResponseCommon(200, 'SUCCESS', {
        id: payment.id,
        contractId: contractId ?? '',
        amount,
        method,
        status: payment.status,
      });
    }

    if (method === PaymentMethodEnum.VNPAY) {
      // 2B) Thanh toán VNPAY: tạo URL và giữ PENDING chờ IPN
      const { data } = await this.createVnpayPaymentLink({
        contractId: contractId ?? '',
        amount,
        ipAddr: ctx.ipAddr,
        orderInfo: dto.orderInfo ?? `Thanh_toan_hop_dong_${contractId}`,
        locale: dto.locale ?? 'vn',
        expireIn: dto.expireIn ?? 15,
      });
      if (!data) {
        throw new Error('Failed to create VNPay payment link');
      }
      const { paymentUrl, txnRef } = data;

      // lưu txnRef để IPN map về
      payment.gatewayTxnRef = txnRef;
      await this.paymentRepository.save(payment);

      return new ResponseCommon(200, 'SUCCESS', {
        id: payment.id,
        contractId: contractId ?? '',
        amount,
        method,
        status: payment.status, // PENDING
        paymentUrl,
        txnRef,
      });
    }

    throw new BadRequestException('Unsupported payment method');
  }

  async findAll(): Promise<ResponseCommon<Payment[]>> {
    const payments = await this.paymentRepository.find({
      relations: ['contract'],
    });
    return new ResponseCommon(200, 'SUCCESS', payments);
  }

  async findOne(id: number): Promise<ResponseCommon<Payment>> {
    const payment = await this.paymentRepository.findOne({
      where: { id: id.toString() },
      relations: ['contract'],
    });

    if (!payment) {
      throw new Error(`Payment with id ${id} not found`);
    }

    return new ResponseCommon(200, 'SUCCESS', payment);
  }

  async update(
    id: number,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<ResponseCommon<Payment>> {
    await this.paymentRepository.update(id, updatePaymentDto);
    const updated = await this.paymentRepository.findOne({
      where: { id: id.toString() },
      relations: ['contract'],
    });
    if (!updated) {
      throw new Error(`Payment with id ${id} not found`);
    }
    if (updatePaymentDto.status === PaymentStatusEnum.PAID) {
      await this.onPaymentPaid(updated.id);
    }
    return new ResponseCommon(200, 'SUCCESS', updated);
  }

  /**
   * Tạo URL thanh toán VNPay (sandbox/prod tùy ENV).
   * - Chỉ sinh link, KHÔNG ghi DB tại đây (để mỗi hàm làm đúng 1 việc).
   * - Trả về: { paymentUrl, txnRef }
   */
  createVnpayPaymentLink(input: {
    contractId: string;
    amount: number; // VND
    ipAddr: string; // IP thực của client
    orderInfo?: string;
    locale?: 'vn'; // default 'vn'
    expireIn?: number; // minutes, default 15
  }): Promise<ResponseCommon<{ paymentUrl: string; txnRef: string }>> {
    const {
      contractId,
      amount,
      ipAddr,
      orderInfo = `Thanh toan hop dong ${contractId}`,
      locale = 'vn',
      expireIn = 15,
    } = input;

    // Lấy config (ưu tiên typed config "vnpay", fallback ENV thuần)
    const tmnCode = this.vnpay.tmnCode;
    const hashSecret = this.vnpay.hashSecret;
    const vnpUrl = this.vnpay.url;
    const returnUrl = this.vnpay.returnUrl;

    if (!tmnCode || !hashSecret || !vnpUrl || !returnUrl) {
      throw new Error(
        'VNPay config is missing (tmnCode/hashSecret/url/returnUrl).',
      );
    }

    // Chuẩn hoá orderInfo: ASCII + bỏ ký tự gây rủi ro khi ký
    const safeOrderInfo = orderInfo
      .normalize('NFKD') // bỏ dấu nếu có
      .replace(/[^\x20-\x7E]/g, '') // ASCII visible
      .replace(/[#&=?]/g, ' ') // tránh ký tự đặc biệt
      .trim();

    const now = vnNow();
    const createDate = vnpFormatYYYYMMDDHHmmss(now);
    const expireDate = vnpFormatYYYYMMDDHHmmss(
      addMinutesVN(now, expireIn || 15),
    );

    // vnp_TxnRef phải duy nhất
    const txnRef = this.generateVnpTxnRef();

    let vnp_Params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(Math.round(amount) * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: safeOrderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: locale,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // 1) sort keys A→Z
    vnp_Params = this.sortObjectByKey(vnp_Params);

    // 2) tạo signData THEO MẪU NODEJS VNPAY: stringify với { encode: false }
    const signData = qs.stringify(vnp_Params, '&', '=');

    // 3) HMAC-SHA512 (hex thường như sample)
    const vnp_SecureHash = crypto
      .createHmac('sha512', hashSecret.trim())
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    // 4) gắn hash và build URL BẰNG CÙNG CÁCH stringify (encode: false)
    vnp_Params['vnp_SecureHash'] = vnp_SecureHash;

    const query = qs.stringify(vnp_Params, '&', '=');
    const paymentUrl = `${vnpUrl}?${query}`;

    // Debug:
    // console.log('signData =', signData);
    // console.log('vnp_SecureHash =', vnp_SecureHash);
    // console.log('paymentUrl =', paymentUrl);

    return Promise.resolve(
      new ResponseCommon(200, 'SUCCESS', { paymentUrl, txnRef }),
    );
  }

  async verifyVnpayReturn(query: Record<string, string>): Promise<
    ResponseCommon<{
      ok: boolean;
      reason: string;
      code: string | undefined;
      status: string | undefined;
      txnRef: string | undefined;
      amount: number;
      bankCode?: string;
      payDate?: string;
      orderInfo?: string;
    }>
  > {
    // 1) Lấy secret từ config
    const secret = this.vnpay.hashSecret;
    if (!secret) {
      throw new Error('VNPay hashSecret is missing.');
    }

    // 2) Lấy hash và loại nó khỏi tập tham số
    const receivedHash = (query.vnp_SecureHash || '').toLowerCase();
    const { vnp_SecureHash, vnp_SecureHashType, ...raw } = query;

    // 3) Chỉ giữ các key bắt đầu bằng vnp_ rồi sort
    const vnpParams: Record<string, string> = {};
    Object.keys(raw)
      .filter((k) => k.startsWith('vnp_'))
      .sort()
      .forEach((k) => (vnpParams[k] = raw[k]));

    // 4) Tạo chuỗi ký THEO ĐÚNG SAMPLE NODEJS của VNPAY
    const signData = qs.stringify(vnpParams, '&', '=');

    // 5) Tính HMAC và so sánh
    const signed = crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex')
      .toLowerCase();

    const okSignature = signed === receivedHash;

    // 6) Kết quả
    const txnRef = vnpParams['vnp_TxnRef'];
    const amount = Number(vnpParams['vnp_Amount'] || 0) / 100; // đổi về VND
    const code = vnpParams['vnp_ResponseCode']; // '00' = success
    const status = vnpParams['vnp_TransactionStatus']; // '00' = success

    return Promise.resolve(
      new ResponseCommon(200, 'SUCCESS', {
        ok: okSignature && code === '00' && status === '00',
        reason: !okSignature
          ? 'INVALID_SIGNATURE'
          : code === '00'
            ? 'OK'
            : 'GATEWAY_FAILED',
        code, // 00/.. từ VNPay
        status, // 00/.. từ VNPay
        txnRef, // để FE/BE tra cứu payment
        amount,
        // có thể trả thêm bankCode, payDate...
        bankCode: vnpParams['vnp_BankCode'],
        payDate: vnpParams['vnp_PayDate'],
        orderInfo: vnpParams['vnp_OrderInfo'],
      }),
    );
  }

  async handleVnpayIpn(
    query: Record<string, string>,
  ): Promise<ResponseCommon<string>> {
    try {
      const secret = this.vnpay?.hashSecret;
      const tmnCode = this.vnpay?.tmnCode;
      if (!secret || !tmnCode)
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=99&Message=Config missing',
        );

      const receivedHash = (query.vnp_SecureHash || '').toLowerCase();
      const { vnp_SecureHash, vnp_SecureHashType, ...raw } = query;

      const vnpParams: Record<string, string> = {};
      Object.keys(raw)
        .filter((k) => k.startsWith('vnp_'))
        .sort()
        .forEach((k) => {
          vnpParams[k] = raw[k];
        });

      const signData = qs.stringify(vnpParams, '&', '=');

      const signed = crypto
        .createHmac('sha512', secret)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex')
        .toLowerCase();

      if (signed !== receivedHash) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=97&Message=Invalid Checksum',
        );
      }

      if (vnpParams['vnp_TmnCode'] !== tmnCode) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=11&Message=Invalid TmnCode',
        );
      }

      const txnRef = vnpParams['vnp_TxnRef'];
      if (!txnRef) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=01&Message=Order not found',
        );
      }

      const payment = await this.paymentRepository.findOne({
        where: { gatewayTxnRef: txnRef },
        relations: [
          'contract',
          'contract.tenant',
          'contract.property',
          'contract.landlord',
        ],
      });

      if (!payment) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=01&Message=Order not found',
        );
      }

      const amountFromGateway = Number(vnpParams['vnp_Amount'] || 0);
      if (!Number.isFinite(amountFromGateway)) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=04&Message=Amount invalid',
        );
      }

      const expected = Math.round(Number(payment.amount) * 100);
      if (expected !== amountFromGateway) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=04&Message=Amount mismatch',
        );
      }

      if (payment.status === PaymentStatusEnum.PAID) {
        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=02&Message=Order already confirmed',
        );
      }

      const responseCode = vnpParams['vnp_ResponseCode'];
      const transStatus = vnpParams['vnp_TransactionStatus'];
      const transactionNo = vnpParams['vnp_TransactionNo'];
      const bankCode = vnpParams['vnp_BankCode'];
      const payDate = vnpParams['vnp_PayDate'];

      if (responseCode === '00' && transStatus === '00') {
        payment.status = PaymentStatusEnum.PAID;
        payment.transactionNo = transactionNo ?? payment.transactionNo;
        payment.bankCode = bankCode ?? payment.bankCode;
        payment.paidAt = payDate ? parseVnpPayDateToUtc(payDate) : vnNow();
        await this.paymentRepository.save(payment);

        await this.onPaymentPaid(payment.id, payment);

        return new ResponseCommon(
          200,
          'SUCCESS',
          'RspCode=00&Message=Confirm Success',
        );
      }

      payment.status = PaymentStatusEnum.FAILED;
      await this.paymentRepository.save(payment);

      return new ResponseCommon(
        200,
        'SUCCESS',
        'RspCode=00&Message=Confirm Success',
      );
    } catch (error) {
      console.error('VNPay IPN error', error);
      return new ResponseCommon(
        200,
        'SUCCESS',
        'RspCode=99&Message=Unknown error',
      );
    }
  }

  private async onPaymentPaid(paymentId: string, loaded?: Payment) {
    console.log(`🔔 onPaymentPaid called for payment: ${paymentId}`);
    
    const payment =
      loaded ??
      (await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: [
          'contract',
          'contract.tenant',
          'contract.property',
          'contract.landlord',
        ],
      }));

    if (!payment || !payment.contract) {
      console.log(`❌ Payment or contract not found`, { paymentId, hasPayment: !!payment, hasContract: !!payment?.contract });
      return;
    }

    console.log(`📋 Payment details:`, {
      id: payment.id,
      purpose: payment.purpose,
      amount: payment.amount,
      contractId: payment.contract.id,
      contractCode: payment.contract.contractCode,
    });

    // Xử lý theo mục đích payment
    // Hiện có 3 mục đích chính:
    // - Tenant đặt cọc vào Escrow (PaymentPurpose.TENANT_ESCROW_DEPOSIT)
    // - Landlord đặt cọc vào Escrow (PaymentPurpose.LANDLORD_ESCROW_DEPOSIT)
    // - Tenant trả tiền thuê tháng đầu (PaymentPurpose.FIRST_MONTH_RENT)
    // - Tenant trả tiền thuê hàng tháng (PaymentPurpose.MONTHLY_RENT) -- chưa xử lý tự động

    if (
      payment.purpose === PaymentPurpose.TENANT_ESCROW_DEPOSIT ||
      payment.purpose === PaymentPurpose.LANDLORD_ESCROW_DEPOSIT
    ) {
     await this.escrowService.creditDepositFromPayment(payment.id);

      try {
        await this.recordDepositOnBlockchain(payment);
      } catch (error) {
        console.error('❌ Failed to record deposit on blockchain:', error);
      }

      const tenantId = payment.contract.tenant?.id;
      const propertyId = payment.contract.property?.id;

      if (tenantId && propertyId) {
        try {
          if (payment.purpose === PaymentPurpose.TENANT_ESCROW_DEPOSIT) {
            await this.bookingService.markTenantDepositFundedByTenantAndProperty(
              tenantId,
              propertyId,
            );
          } else {
            await this.bookingService.markLandlordDepositFundedByTenantAndProperty(
              tenantId,
              propertyId,
            );
          }
        } catch (error) {
          console.error('Failed to sync booking escrow state', error);
        }
      }

      return;
    }

    if (payment.purpose === PaymentPurpose.FIRST_MONTH_RENT) {
      await this.creditFirstMonthRentToLandlord(payment);
      
      // Sync first payment to blockchain
      try {
        await this.recordFirstPaymentOnBlockchain(payment);
      } catch (error) {
        console.error('Failed to record first payment on blockchain:', error);
        // Continue execution - blockchain sync failure shouldn't block payment processing
      }
      
      const tenantId = payment.contract.tenant?.id;
      const propertyId = payment.contract.property?.id;
      if (tenantId && propertyId) {
        try {
          await this.bookingService.markFirstRentPaidByTenantAndProperty(
            tenantId,
            propertyId,
          );
        } catch (error) {
          console.error('Failed to sync booking first rent state', error);
        }
      }
      return;
    }
    
    // Xử lý MONTHLY_RENT payment
    if (payment.purpose === PaymentPurpose.MONTHLY_RENT) {
      await this.processMonthlyRentPayment(payment);
      return;
    }
  }

  private async creditFirstMonthRentToLandlord(payment: Payment) {
    const landlordId = payment.contract?.landlord?.id;

    if (!landlordId) {
      console.warn('Missing landlord information for first rent payment', {
        paymentId: payment.id,
        contractId: payment.contract?.id,
      });
      return;
    }

    const contractCode =
      payment.contract?.contractCode ?? payment.contract?.id ?? undefined;
    const note = contractCode
      ? `First month rent for contract ${contractCode}`
      : 'First month rent payout';

    try {
      await this.walletService.credit(landlordId, {
        amount: Number(payment.amount),
        type: WalletTxnType.CONTRACT_PAYMENT,
        refId: payment.id,
        note,
      });
    } catch (error) {
      console.error(
        'Failed to credit landlord wallet for first month rent',
        error,
      );
      throw error;
    }
  }

  /**
   * Record first payment on blockchain
   * NOTE: blockchainService.recordFirstPayment() tự động activate contract trên blockchain
   */
  private async recordFirstPaymentOnBlockchain(payment: Payment): Promise<void> {
    try {
      const contract = payment.contract;
      if (!contract?.contractCode) {
        console.warn('Cannot record first payment: missing contract code');
        return;
      }

      // Create FabricUser for tenant (who made the payment)
      const fabricUser = {
        userId: contract.tenant.id,
        orgName: 'OrgTenant',
        mspId: 'OrgTenantMSP',
      };

      // Gọi recordFirstPayment - method này tự động activate contract trên blockchain
      await this.blockchainService.recordFirstPayment(
        contract.contractCode,
        payment.amount.toString(),
        payment.id, // Use payment ID as transaction reference
        fabricUser
      );

      console.log(`✅ First payment recorded on blockchain for contract ${contract.contractCode} (contract auto-activated)`);
    } catch (error) {
      console.error('❌ Failed to record first payment on blockchain:', error);
      throw error;
    }
  }

  /**
   * Process monthly rent payment
   */
  private async processMonthlyRentPayment(payment: Payment): Promise<void> {
    try {
      // 1. Credit landlord wallet
      await this.creditMonthlyRentToLandlord(payment);

      // 2. Record payment on blockchain
      await this.recordMonthlyPaymentOnBlockchain(payment);

      console.log(`✅ Monthly rent payment processed for contract ${payment.contract?.contractCode}`);
    } catch (error) {
      console.error('❌ Failed to process monthly rent payment:', error);
      throw error;
    }
  }

  /**
   * Credit monthly rent to landlord wallet
   */
  private async creditMonthlyRentToLandlord(payment: Payment): Promise<void> {
    const landlordId = payment.contract?.landlord?.id;

    if (!landlordId) {
      console.warn('Missing landlord information for monthly rent payment', {
        paymentId: payment.id,
        contractId: payment.contract?.id,
      });
      return;
    }

    const contractCode =
      payment.contract?.contractCode ?? payment.contract?.id ?? undefined;
    const note = contractCode
      ? `Monthly rent for contract ${contractCode}`
      : 'Monthly rent payout';

    try {
      await this.walletService.credit(landlordId, {
        amount: Number(payment.amount),
        type: WalletTxnType.CONTRACT_PAYMENT,
        refId: payment.id,
        note,
      });
    } catch (error) {
      console.error('Failed to credit landlord wallet for monthly rent', error);
      throw error;
    }
  }

  /**
   * Record monthly payment on blockchain
   */
  private async recordMonthlyPaymentOnBlockchain(payment: Payment): Promise<void> {
    try {
      const contract = payment.contract;
      if (!contract?.contractCode) {
        console.warn('Cannot record monthly payment: missing contract code');
        return;
      }

      // Create FabricUser for tenant (who made the payment)
      const fabricUser = {
        userId: contract.tenant.id,
        orgName: 'OrgTenant',
        mspId: 'OrgTenantMSP',
      };

      // Generate period string (e.g., "2025-01" for January 2025)
      const paymentDate = new Date();
      const period = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, '0')}`;

      await this.blockchainService.recordPayment(
        contract.contractCode,
        period,
        payment.amount.toString(),
        fabricUser,
        payment.id // orderRef
      );

      console.log(`✅ Monthly payment recorded on blockchain for contract ${contract.contractCode}, period ${period}`);
    } catch (error) {
      console.error('❌ Failed to record monthly payment on blockchain:', error);
      throw error;
    }
  }

  /**
   * Record deposit payment on blockchain
   */
  private async recordDepositOnBlockchain(payment: Payment): Promise<void> {
    try {
      const contract = payment.contract;
      if (!contract?.contractCode) {
        console.warn('❌ Cannot record deposit: missing contract code', {
          paymentId: payment.id,
          contractId: payment.contract?.id
        });
        return;
      }


      // Determine party based on payment purpose
      let party: 'tenant' | 'landlord';
      let fabricUser: any;

      if (payment.purpose === PaymentPurpose.TENANT_ESCROW_DEPOSIT) {
        party = 'tenant';
        fabricUser = {
          userId: contract.tenant.id,
          orgName: 'OrgTenant',
          mspId: 'OrgTenantMSP',
        };
        console.log(`👤 Tenant deposit detected, userId: ${contract.tenant.id}`);
      } else if (payment.purpose === PaymentPurpose.LANDLORD_ESCROW_DEPOSIT) {
        party = 'landlord';
        fabricUser = {
          userId: contract.landlord.id,
          orgName: 'OrgLandlord',
          mspId: 'OrgLandlordMSP',
        };
        console.log(`🏠 Landlord deposit detected, userId: ${contract.landlord.id}`);
      } else {
        console.warn('❌ Invalid payment purpose for deposit recording:', payment.purpose);
        return;
      }

      await this.blockchainService.recordDeposit(
        contract.contractCode,
        party,
        payment.amount.toString(),
        payment.id, // Use payment ID as deposit transaction reference
        fabricUser
      );
      console.log(`✅ ${party} deposit recorded on blockchain for contract ${contract.contractCode}`);
    } catch (error) {
      console.error('❌ Failed to record deposit on blockchain:', error);
      throw error;
    }
  }

  /** ===== Helpers ===== */

  private generateVnpTxnRef() {
    // YYMMDDHHmmss + 6 số ngẫu nhiên — đủ uniqueness cho TEST/DEV
    const nowCode = formatVN(vnNow(), 'yyMMddHHmmss');
    const rnd = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `${nowCode}${rnd}`;
  }

  private sortObjectByKey(obj: Record<string, string>) {
    return Object.keys(obj)
      .sort()
      .reduce(
        (acc, k) => {
          acc[k] = obj[k];
          return acc;
        },
        {} as Record<string, string>,
      );
  }
}
