import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyUtility } from './entities/property-utility.entity';
import { PropertyUtilityService } from './property-utility.service';
import { PropertyUtilityController } from './property-utility.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyUtility])],
  controllers: [PropertyUtilityController],
  providers: [PropertyUtilityService],
  exports: [PropertyUtilityService, TypeOrmModule],
})
export class PropertyUtilityModule {}
