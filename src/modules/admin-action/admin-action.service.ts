import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAction } from './entities/admin-action.entity';
import { CreateAdminActionDto } from './dto/create-admin-action.dto';
import { UpdateAdminActionDto } from './dto/update-admin-action.dto';

@Injectable()
export class AdminActionService {
  constructor(
    @InjectRepository(AdminAction)
    private adminActionRepository: Repository<AdminAction>,
  ) {}

  async create(
    createAdminActionDto: CreateAdminActionDto,
  ): Promise<AdminAction> {
    const action = this.adminActionRepository.create(createAdminActionDto);
    return this.adminActionRepository.save(action);
  }

  async findAll(): Promise<AdminAction[]> {
    return this.adminActionRepository.find({ relations: ['admin', 'target'] });
  }

  async findOne(id: number): Promise<AdminAction | null> {
    const action = await this.adminActionRepository.findOne({
      where: { id: id.toString() },
      relations: ['admin', 'target'],
    });
    return action;
  }

  async update(
    id: number,
    updateAdminActionDto: UpdateAdminActionDto,
  ): Promise<AdminAction> {
    await this.adminActionRepository.update(id, updateAdminActionDto);
    const updatedAction = await this.findOne(id);
    if (!updatedAction) {
      throw new Error(`AdminAction with id ${id} not found`);
    }
    return updatedAction;
  }

  async remove(id: number): Promise<void> {
    await this.adminActionRepository.delete(id);
  }
}
