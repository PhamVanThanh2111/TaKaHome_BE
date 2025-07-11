import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto): Promise<Favorite> {
    const favorite = this.favoriteRepository.create(createFavoriteDto as any);
    return this.favoriteRepository.save(favorite);
  }

  async findAll(): Promise<Favorite[]> {
    return this.favoriteRepository.find({ relations: ['user', 'property'] });
  }

  async findOne(id: number): Promise<Favorite> {
    return this.favoriteRepository.findOne({
      where: { id },
      relations: ['user', 'property'],
    });
  }

  async update(
    id: number,
    updateFavoriteDto: UpdateFavoriteDto,
  ): Promise<Favorite> {
    await this.favoriteRepository.update(id, updateFavoriteDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.favoriteRepository.delete(id);
  }
}
