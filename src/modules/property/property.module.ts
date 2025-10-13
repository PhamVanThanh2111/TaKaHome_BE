import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { Booking } from '../booking/entities/booking.entity';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { S3StorageModule } from '../s3-storage/s3-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, Room, RoomType, Booking]),
    S3StorageModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService, TypeOrmModule],
})
export class PropertyModule {}
