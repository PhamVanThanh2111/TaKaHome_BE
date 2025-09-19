import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async findAll(): Promise<ResponseCommon<Account[]>> {
    const accounts = await this.accountRepo.find({ relations: ['user'] });
    return new ResponseCommon(200, 'SUCCESS', accounts);
  }

  async findOne(id: string): Promise<ResponseCommon<Account | null>> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async findByEmail(email: string): Promise<ResponseCommon<Account | null>> {
    const account = await this.accountRepo.findOne({
      where: { email },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async update(
    id: string,
    dto: UpdateAccountDto,
  ): Promise<ResponseCommon<Account | null>> {
    await this.accountRepo.update(id, dto);
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.accountRepo.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
