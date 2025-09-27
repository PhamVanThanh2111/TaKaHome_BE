import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
  ) {}

  async create(
    createFavoriteDto: CreateFavoriteDto,
  ): Promise<ResponseCommon<Favorite>> {
    const favorite = this.favoriteRepository.create(
      createFavoriteDto as Partial<Favorite>,
    );
    const saved = await this.favoriteRepository.save(favorite);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Favorite[]>> {
    const favorites = await this.favoriteRepository.find({
      relations: ['user', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorites);
  }

  async findOne(id: number): Promise<ResponseCommon<Favorite | null>> {
    const favorite = await this.favoriteRepository.findOne({
      where: { id: id.toString() },
      relations: ['user', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorite);
  }

  async update(
    id: number,
    updateFavoriteDto: UpdateFavoriteDto,
  ): Promise<ResponseCommon<Favorite>> {
    await this.favoriteRepository.update(
      id,
      updateFavoriteDto as Partial<Favorite>,
    );
    const updatedFavorite = await this.favoriteRepository.findOne({
      where: { id: id.toString() },
      relations: ['user', 'property'],
    });
    if (!updatedFavorite) {
      throw new Error(`Favorite with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updatedFavorite);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.favoriteRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
