import { Module } from '@nestjs/common';
import { SmartCAService } from './smartca.service';
import { SmartCAController } from './smartca.controller';
import { RootCAService } from './root-ca.service';
import { CertificateService } from './certificate.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateKey } from './entities/certificate-key.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([CertificateKey]), UserModule],
  providers: [SmartCAService, RootCAService, CertificateService],
  controllers: [SmartCAController],
  exports: [SmartCAService, RootCAService, CertificateService],
})
export class SmartCAModule {}
