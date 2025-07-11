import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from './entities/verification.entity';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { VerificationTypeEnum } from '../common/enums/verification-type.enum';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
  ) {}

  async create(
    createVerificationDto: CreateVerificationDto,
  ): Promise<Verification> {
    const { userId, type, documentUrl, verifiedById } = createVerificationDto;
    const verification = this.verificationRepository.create({
      type: type || VerificationTypeEnum.NONE,
      documentUrl,
      user: { id: userId },
      ...(verifiedById && { verifiedBy: { id: verifiedById } }),
    });
    return this.verificationRepository.save(verification);
  }

  async findAll(): Promise<Verification[]> {
    return this.verificationRepository.find({
      relations: ['user', 'verifiedBy'],
    });
  }

  async findOne(id: number): Promise<Verification> {
    const verification = await this.verificationRepository.findOne({
      where: { id: id.toString() },
      relations: ['user', 'verifiedBy'],
    });
    if (!verification) {
      throw new Error(`Verification with id ${id} not found`);
    }
    return verification;
  }

  async update(
    id: number,
    updateVerificationDto: UpdateVerificationDto,
  ): Promise<Verification> {
    await this.verificationRepository.update(id, updateVerificationDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.verificationRepository.delete(id);
  }
}
