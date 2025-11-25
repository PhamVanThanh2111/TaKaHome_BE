import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { REPORT_ERRORS } from 'src/common/constants/error-messages.constant';
import { Contract } from '../contract/entities/contract.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
  ) {}

  async create(
    createReportDto: CreateReportDto,
    reporterId: string,
  ): Promise<ResponseCommon<Report>> {
    const { propertyId, content } = createReportDto;
    const contract = await this.contractRepository.findOne({
      where: { property: { id: propertyId }, tenant: { id: reporterId } },
    });
    if (!contract) {
      throw new NotFoundException(REPORT_ERRORS.REPORTER_NO_RENTED_PROPERTY);
    }
    const reportExists = await this.reportRepository.findOne({
      where: { reporter: { id: reporterId }, property: { id: propertyId } },
    });
    if (reportExists) {
      throw new Error(REPORT_ERRORS.REPORT_ALREADY_EXISTS);
    }
    const report = this.reportRepository.create({
      content,
      property: { id: propertyId },
      reporter: { id: reporterId },
    });
    const saved = await this.reportRepository.save(report);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Report[]>> {
    const reports = await this.reportRepository.find({
      relations: ['reporter', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', reports);
  }

  async findOne(id: string): Promise<ResponseCommon<Report>> {
    const report = await this.reportRepository.findOne({
      where: { id: id },
      relations: ['reporter', 'property'],
    });
    if (!report) {
      throw new NotFoundException(REPORT_ERRORS.REPORT_NOT_FOUND);
    }
    return new ResponseCommon(200, 'SUCCESS', report);
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
  ): Promise<ResponseCommon<Report>> {
    await this.reportRepository.update(id, updateReportDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.reportRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
