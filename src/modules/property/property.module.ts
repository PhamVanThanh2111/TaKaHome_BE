import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Property])],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService, TypeOrmModule],
})
export class PropertyModule {}
