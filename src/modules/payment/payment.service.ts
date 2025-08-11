import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ConfigType } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'querystring';
import vnpayConfig from 'src/config/vnpay.config';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(vnpayConfig.KEY)
    private readonly vnpay: ConfigType<typeof vnpayConfig>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const { contractId, amount, method, status } = createPaymentDto;
    const payment = this.paymentRepository.create({
      contract: { id: contractId },
      amount,
      method,
      status,
    });
    return this.paymentRepository.save(payment);
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentRepository.find({ relations: ['contract'] });
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: id.toString() },
      relations: ['contract'],
    });

    if (!payment) {
      throw new Error(`Payment with id ${id} not found`);
    }

    return payment;
  }

  async update(
    id: number,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    await this.paymentRepository.update(id, updatePaymentDto);
    return this.findOne(id);
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
    locale?: 'vn' | 'en'; // default 'vn'
    expireIn?: number; // minutes, default 15
  }): Promise<{ paymentUrl: string; txnRef: string }> {
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

    const createDate = this.formatDateYYYYMMDDHHmmss(new Date());
    const expireDate = this.formatDateYYYYMMDDHHmmss(
      new Date(Date.now() + (expireIn || 15) * 60 * 1000),
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

    return Promise.resolve({ paymentUrl, txnRef });
  }

  /** ===== Helpers (đặt trong class PaymentService) ===== */

  private formatDateYYYYMMDDHHmmss(d: Date) {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  private generateVnpTxnRef() {
    // YYMMDDHHmmss + 6 số ngẫu nhiên — đủ uniqueness cho TEST/DEV
    const now = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const y = `${now.getFullYear()}`.slice(-2);
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const rnd = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `${y}${MM}${dd}${HH}${mm}${ss}${rnd}`;
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

  async verifyVnpayReturn(query: Record<string, string>) {
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

    return Promise.resolve({
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
    });
  }
}
