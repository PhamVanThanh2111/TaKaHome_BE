import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  async create(
    createReportDto: CreateReportDto,
  ): Promise<ResponseCommon<Report>> {
    const { propertyId, reporterId, content } = createReportDto;
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

  async findOne(id: number): Promise<ResponseCommon<Report>> {
    const report = await this.reportRepository.findOne({
      where: { id: id.toString() },
      relations: ['reporter', 'property'],
    });
    if (!report) {
      throw new Error(`Report with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', report);
  }

  async update(
    id: number,
    updateReportDto: UpdateReportDto,
  ): Promise<ResponseCommon<Report>> {
    await this.reportRepository.update(id, updateReportDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.reportRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
