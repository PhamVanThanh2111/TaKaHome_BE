import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Verification } from './entities/verification.entity';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Verification])],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService, TypeOrmModule],
})
export class VerificationModule {}
