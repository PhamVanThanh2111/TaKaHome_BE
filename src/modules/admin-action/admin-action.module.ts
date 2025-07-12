import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAction } from './entities/admin-action.entity';
import { AdminActionService } from './admin-action.service';
import { AdminActionController } from './admin-action.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAction])],
  controllers: [AdminActionController],
  providers: [AdminActionService],
  exports: [AdminActionService, TypeOrmModule],
})
export class AdminActionModule {}
