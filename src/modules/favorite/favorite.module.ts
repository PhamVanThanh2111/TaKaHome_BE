import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService, TypeOrmModule],
})
export class FavoriteModule {}
