import { Injectable } from '@nestjs/common';
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

  async findAll(): Promise<ResponseCommon> {
    const users = await this.userRepository.find({ relations: ['account'] });
    return new ResponseCommon(200, 'SUCCESS', users);
  }

  async findOne(id: string): Promise<ResponseCommon> {
    const user = await this.userRepository.findOne({
      where: { id: id.toString() },
      relations: ['account'],
    });
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseCommon> {
    await this.userRepository.update(id, updateUserDto);
    return new ResponseCommon(200, 'SUCCESS', await this.findOne(id));
  }

  async remove(id: string): Promise<ResponseCommon> {
    await this.userRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS');
  }
}
