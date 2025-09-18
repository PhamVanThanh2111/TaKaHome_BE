import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAction } from './entities/admin-action.entity';
import { CreateAdminActionDto } from './dto/create-admin-action.dto';
import { UpdateAdminActionDto } from './dto/update-admin-action.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class AdminActionService {
  constructor(
    @InjectRepository(AdminAction)
    private adminActionRepository: Repository<AdminAction>,
  ) {}

  async create(
    createAdminActionDto: CreateAdminActionDto,
  ): Promise<ResponseCommon<AdminAction>> {
    const action = this.adminActionRepository.create(createAdminActionDto);
    const saved = await this.adminActionRepository.save(action);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<AdminAction[]>> {
    const actions = await this.adminActionRepository.find({
      relations: ['admin', 'target'],
    });
    return new ResponseCommon(200, 'SUCCESS', actions);
  }

  async findOne(id: number): Promise<ResponseCommon<AdminAction | null>> {
    const action = await this.adminActionRepository.findOne({
      where: { id: id.toString() },
      relations: ['admin', 'target'],
    });
    return new ResponseCommon(200, 'SUCCESS', action);
  }

  async update(
    id: number,
    updateAdminActionDto: UpdateAdminActionDto,
  ): Promise<ResponseCommon<AdminAction>> {
    await this.adminActionRepository.update(id, updateAdminActionDto);
    const updatedAction = await this.adminActionRepository.findOne({
      where: { id: id.toString() },
      relations: ['admin', 'target'],
    });
    if (!updatedAction) {
      throw new Error(`AdminAction with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updatedAction);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.adminActionRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
