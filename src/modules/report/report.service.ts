import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { REPORT_ERRORS } from 'src/common/constants/error-messages.constant';
import { User } from '../user/entities/user.entity';
import { Property } from '../property/entities/property.entity';
import { Room } from '../property/entities/room.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  async create(
    createReportDto: CreateReportDto,
    reporterId: string,
  ): Promise<ResponseCommon<Report>> {
    const { propertyId, roomId, content } = createReportDto;
   
    // Validate: chỉ có 1 trong 2 là propertyId hoặc roomId
    if ((propertyId && roomId) || (!propertyId && !roomId)) {
      throw new Error('Phải cung cấp propertyId hoặc roomId, không được cả hai hoặc không có gì');
    }

    // Check report exists
    const reportExists = propertyId
      ? await this.reportRepository.findOne({
          where: { reporter: { id: reporterId }, property: { id: propertyId } },
        })
      : await this.reportRepository.findOne({
          where: { reporter: { id: reporterId }, room: { id: roomId as string } },
        });
    
    if (reportExists) {
      throw new Error(REPORT_ERRORS.REPORT_ALREADY_EXISTS);
    }

    // Create report
    const reportPayload: Partial<Report> = {
      content,
      reporter: { id: reporterId } as User,
    };

    if (propertyId) {
      reportPayload.property = { id: propertyId } as Property;
    }
    if (roomId) {
      reportPayload.room = { id: roomId } as Room;
    }

    const report = this.reportRepository.create(reportPayload);
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
