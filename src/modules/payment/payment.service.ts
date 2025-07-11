import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
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
      where: { id },
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
    await this.paymentRepository.update(id, updatePaymentDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.paymentRepository.delete(id);
  }
}
