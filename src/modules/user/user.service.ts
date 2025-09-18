import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<ResponseCommon<User[]>> {
    const users = await this.userRepository.find({ relations: ['account'] });
    return new ResponseCommon(200, 'SUCCESS', users);
  }

  async findOne(id: number): Promise<ResponseCommon<User>> {
    const user = await this.userRepository.findOne({
      where: { id: id.toString() },
      relations: ['account'],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', user);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseCommon<User>> {
    await this.userRepository.update(id, updateUserDto);
    const updated = await this.userRepository.findOne({
      where: { id: id.toString() },
      relations: ['account'],
    });
    if (!updated) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updated);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.userRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
