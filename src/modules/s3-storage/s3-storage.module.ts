import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import s3Config from '../../config/s3.config';

@Module({
  imports: [ConfigModule.forFeature(s3Config)],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class S3StorageModule {}
