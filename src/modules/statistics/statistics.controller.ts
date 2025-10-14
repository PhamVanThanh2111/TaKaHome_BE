import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsService, StatisticsOverview } from './statistics.service';
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
}
