import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyImageService } from './property-image.service';
import { PropertyImageController } from './property-image.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyImage])],
  controllers: [PropertyImageController],
  providers: [PropertyImageService],
  exports: [PropertyImageService, TypeOrmModule],
})
export class PropertyImageModule {}
