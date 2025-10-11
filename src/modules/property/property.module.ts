import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Room, RoomType])],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService, TypeOrmModule],
})
export class PropertyModule {}
