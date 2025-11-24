import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { User } from '../user/entities/user.entity';
import { Property } from '../property/entities/property.entity';
import { RoomType } from '../property/entities/room-type.entity';
import { FAVORITE_ERRORS } from 'src/common/constants/error-messages.constant';

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
    if (!createFavoriteDto.propertyId && !createFavoriteDto.roomTypeId) {
      throw new Error(FAVORITE_ERRORS.JUST_ONE_OF_PROPERTY_ROOMTYPE_REQUIRED);
    }
    const favoriteData: Partial<Favorite> = {
      user: { id: userId } as User,
    };

    if (createFavoriteDto.propertyId) {
      favoriteData.property = { id: createFavoriteDto.propertyId } as Property;
    }

    if (createFavoriteDto.roomTypeId) {
      favoriteData.roomType = { id: createFavoriteDto.roomTypeId } as RoomType;
    }

    const duplicate = await this.favoriteRepository.findOne({
      where: {
        user: { id: userId },
        property: { id: createFavoriteDto.propertyId },
        roomType: { id: createFavoriteDto.roomTypeId },
      },
    });
    if (duplicate) {
      return new ResponseCommon(200, 'SUCCESS', duplicate);
    }

    const favorite = this.favoriteRepository.create(favoriteData);
    const saved = await this.favoriteRepository.save(favorite);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }
  async findAll(userId: string): Promise<ResponseCommon<Favorite[]>> {
    const favorites = await this.favoriteRepository.find({
      where: { user: { id: userId } },
      relations: ['property', 'roomType'],
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

  async remove(id: string, userId: string): Promise<ResponseCommon<null>> {
    if (!id) {
      throw new Error(FAVORITE_ERRORS.JUST_ONE_OF_PROPERTY_ROOMTYPE_REQUIRED);
    }
    const deleteFavoriteProperty = await this.favoriteRepository.findOne({
      where: {
        user: { id: userId },
        property: { id: id },
      },
    });
    const deleteFavoriteRoomType = await this.favoriteRepository.findOne({
      where: {
        user: { id: userId },
        roomType: { id: id },
      },
    });
    if (!deleteFavoriteProperty && !deleteFavoriteRoomType) {
      throw new NotFoundException(FAVORITE_ERRORS.FAVORITE_NOT_FOUND);
    }
    if (deleteFavoriteProperty) {
      await this.favoriteRepository.delete(deleteFavoriteProperty.id);
    }
    if (deleteFavoriteRoomType) {
      await this.favoriteRepository.delete(deleteFavoriteRoomType.id);
    }
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
