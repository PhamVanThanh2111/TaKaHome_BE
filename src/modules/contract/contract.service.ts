import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

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

  async findOne(id: number): Promise<Contract | null> {
    return this.contractRepository.findOne({
      where: { id: id.toString() },
      relations: ['tenant', 'landlord', 'property'],
    });
  }

  async update(
    id: number,
    updateContractDto: UpdateContractDto,
  ): Promise<Contract> {
    await this.contractRepository.update(id, updateContractDto);
    const updatedContract = await this.findOne(id);
    if (!updatedContract) {
      throw new Error(`Contract with id ${id} not found`);
    }
    return updatedContract;
  }

  async remove(id: number): Promise<void> {
    await this.contractRepository.delete(id);
  }
}
