import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: CreateReportDto): Promise<Report> {
    const { propertyId, reporterId, content } = createReportDto;
    const report = this.reportRepository.create({
      content,
      property: { id: propertyId },
      reporter: { id: reporterId },
    });
    return this.reportRepository.save(report);
  }

  async findAll(): Promise<Report[]> {
    return this.reportRepository.find({ relations: ['reporter', 'property'] });
  }

  async findOne(id: number): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter', 'property'],
    });
    if (!report) {
      throw new Error(`Report with id ${id} not found`);
    }
    return report;
  }

  async update(id: number, updateReportDto: UpdateReportDto): Promise<Report> {
    await this.reportRepository.update(id, updateReportDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.reportRepository.delete(id);
  }
}
