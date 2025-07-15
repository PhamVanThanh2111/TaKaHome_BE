import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountRepo.find({ relations: ['user'] });
  }

  async findOne(id: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { id }, relations: ['user'] });
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { email }, relations: ['user'] });
  }

  async update(id: string, dto: UpdateAccountDto): Promise<Account | null> {
    await this.accountRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.accountRepo.delete(id);
  }
}
