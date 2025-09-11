import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
  ) {}

  async create(createContractDto: CreateContractDto): Promise<Contract> {
    const contract = this.contractRepository.create(createContractDto);
    return this.contractRepository.save(contract);
  }

  async findAll(): Promise<Contract[]> {
    return this.contractRepository.find({
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  async findOne(id: string): Promise<Contract | null> {
    return this.contractRepository.findOne({
      where: { id: id.toString() },
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  async findByTenant(tenantId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: { tenant: { id: tenantId } },
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  async findByLandlord(landlordId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: { landlord: { id: landlordId } },
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<Contract> {
    await this.contractRepository.update(id, updateContractDto);
    const updatedContract = await this.findOne(id);
    if (!updatedContract) {
      throw new Error(`Contract with id ${id} not found`);
    }
    return updatedContract;
  }

  private ensureStatus(
    contract: Contract,
    expected: ContractStatusEnum[],
  ): void {
    if (!expected.includes(contract.status)) {
      throw new BadRequestException(
        `Invalid state: ${contract.status}. Expected: ${expected.join(', ')}`,
      );
    }
  }

  async activate(id: string): Promise<Contract> {
    const contract = await this.findOne(id);
    if (!contract) throw new Error(`Contract with id ${id} not found`);
    this.ensureStatus(contract, [ContractStatusEnum.PENDING_SIGNATURE]);
    contract.status = ContractStatusEnum.ACTIVE;
    return this.contractRepository.save(contract);
  }

  async complete(id: string): Promise<Contract> {
    const contract = await this.findOne(id);
    if (!contract) throw new Error(`Contract with id ${id} not found`);
    this.ensureStatus(contract, [ContractStatusEnum.ACTIVE]);
    contract.status = ContractStatusEnum.COMPLETED;
    return this.contractRepository.save(contract);
  }

  async cancel(id: string): Promise<Contract> {
    const contract = await this.findOne(id);
    if (!contract) throw new Error(`Contract with id ${id} not found`);
    this.ensureStatus(contract, [
      ContractStatusEnum.DRAFT,
      ContractStatusEnum.PENDING_SIGNATURE,
    ]);
    contract.status = ContractStatusEnum.CANCELLED;
    return this.contractRepository.save(contract);
  }

  async terminate(id: string): Promise<Contract> {
    const contract = await this.findOne(id);
    if (!contract) throw new Error(`Contract with id ${id} not found`);
    this.ensureStatus(contract, [ContractStatusEnum.ACTIVE]);
    contract.status = ContractStatusEnum.TERMINATED;
    return this.contractRepository.save(contract);
  }
}
