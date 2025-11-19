import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { User } from '../user/entities/user.entity';
import { Property } from '../property/entities/property.entity';
import { RoomType } from '../property/entities/room-type.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
  ) {}

  async create(
    createFavoriteDto: CreateFavoriteDto,
    userId: string,
  ): Promise<ResponseCommon<Favorite>> {
    const favoriteData: Partial<Favorite> = {
      user: { id: userId } as User,
    };

    if (createFavoriteDto.propertyId) {
      favoriteData.property = { id: createFavoriteDto.propertyId } as Property;
    }

    if (createFavoriteDto.roomTypeId) {
      favoriteData.roomType = { id: createFavoriteDto.roomTypeId } as RoomType;
    }

    const favorite = this.favoriteRepository.create(favoriteData);
    const saved = await this.favoriteRepository.save(favorite);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }  async findAll(): Promise<ResponseCommon<Favorite[]>> {
    const favorites = await this.favoriteRepository.find({
      relations: ['user', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorites);
  }

  async findOne(id: string): Promise<ResponseCommon<Favorite | null>> {
    const favorite = await this.favoriteRepository.findOne({
      where: { id: id },
      relations: ['user', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorite);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.favoriteRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
