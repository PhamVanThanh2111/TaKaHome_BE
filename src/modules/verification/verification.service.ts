import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from './entities/verification.entity';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { VerificationTypeEnum } from '../common/enums/verification-type.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
  ) {}

  async create(
    createVerificationDto: CreateVerificationDto,
  ): Promise<ResponseCommon<Verification>> {
    const { userId, type, documentUrl, verifiedById } = createVerificationDto;
    const verification = this.verificationRepository.create({
      type: type || VerificationTypeEnum.NONE,
      documentUrl,
      user: { id: userId },
      ...(verifiedById && { verifiedBy: { id: verifiedById } }),
    });
    const saved = await this.verificationRepository.save(verification);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Verification[]>> {
    const verifications = await this.verificationRepository.find({
      relations: ['user', 'verifiedBy'],
    });
    return new ResponseCommon(200, 'SUCCESS', verifications);
  }

  async findOne(id: number): Promise<ResponseCommon<Verification>> {
    const verification = await this.verificationRepository.findOne({
      where: { id: id.toString() },
      relations: ['user', 'verifiedBy'],
    });
    if (!verification) {
      throw new Error(`Verification with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', verification);
  }

  async update(
    id: number,
    updateVerificationDto: UpdateVerificationDto,
  ): Promise<ResponseCommon<Verification>> {
    await this.verificationRepository.update(id, updateVerificationDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.verificationRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
