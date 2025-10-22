import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { S3StorageModule } from '../s3-storage/s3-storage.module';
import { CccdRecognitionService } from './services/cccd-recognition.service';
import fptAiConfig from '../../config/fpt-ai.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    S3StorageModule,
    ConfigModule.forFeature(fptAiConfig),
  ],
  controllers: [UserController],
  providers: [UserService, CccdRecognitionService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
