import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import {
  StatisticsService,
  StatisticsOverview,
  LandlordStatistics,
} from './statistics.service';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Controller('statistics')
@ApiTags('Statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan hệ thống' })
  async getOverview(): Promise<ResponseCommon<StatisticsOverview>> {
    return this.statisticsService.getOverview();
  }

  @Get('landlord/:landlordId')
  @ApiOperation({ summary: 'Lấy thống kê thông tin landlord' })
  @ApiParam({ name: 'landlordId', description: 'ID của landlord' })
  async getLandlordStatistics(
    @Param('landlordId') landlordId: string,
  ): Promise<ResponseCommon<LandlordStatistics>> {
    return this.statisticsService.getLandlordStatistics(landlordId);
  }
}
