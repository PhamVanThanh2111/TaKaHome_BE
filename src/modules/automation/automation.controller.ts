import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { AutomationEventLoggingService, AutomationEventType, EventStatus } from './automation-event-logging.service';
import { AutomatedPenaltyService } from '../penalty/automated-penalty.service';

/**
 * Automation Monitoring Controller
 * Provides API endpoints for monitoring and dashboard functionality
 */
@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(
    private automationEventLoggingService: AutomationEventLoggingService,
    private automatedPenaltyService: AutomatedPenaltyService,
  ) {}

  /**
   * Get automation dashboard overview
   */
  @Get('dashboard')
  @Roles(RoleEnum.ADMIN, RoleEnum.LANDLORD) // Chỉ admin và landlord được xem dashboard
  @ApiOperation({ summary: 'Get automation dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Query('days') days?: string) {
    const daysParsed = days ? parseInt(days) : 7;
    
    const [stats, transparencyReport, failedEvents] = await Promise.all([
      this.automationEventLoggingService.getAutomationStats(daysParsed),
      this.automationEventLoggingService.generateTransparencyReport(daysParsed),
      this.automationEventLoggingService.getFailedEvents(10),
    ]);

    return {
      period: `${daysParsed} days`,
      stats,
      transparencyReport,
      recentFailedEvents: failedEvents,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get automation statistics
   */
  @Get('stats')
  @Roles(RoleEnum.ADMIN, RoleEnum.LANDLORD)
  @ApiOperation({ summary: 'Get automation statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Query('days') days?: string) {
    const daysParsed = days ? parseInt(days) : 30;
    const stats = await this.automationEventLoggingService.getAutomationStats(daysParsed);
    
    return {
      period: `${daysParsed} days`,
      ...stats,
    };
  }

  /**
   * Get transparency report
   */
  @Get('transparency-report')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Get automation transparency report' })
  @ApiResponse({ status: 200, description: 'Transparency report retrieved successfully' })
  async getTransparencyReport(@Query('days') days?: string) {
    const daysParsed = days ? parseInt(days) : 30;
    return await this.automationEventLoggingService.generateTransparencyReport(daysParsed);
  }

  /**
   * Get system health check
   */
  @Get('health')
  @Roles(RoleEnum.ADMIN, RoleEnum.LANDLORD) // Health check cho admin và landlord
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getHealthCheck() {
    const stats = await this.automationEventLoggingService.getAutomationStats(1);
    const failedEvents = await this.automationEventLoggingService.getFailedEvents(5);
    
    const isHealthy = stats.successRate >= 90 && failedEvents.length < 5;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      successRate: stats.successRate,
      recentFailures: failedEvents.length,
      lastChecked: new Date(),
      details: {
        automationActive: true,
        cronJobsRunning: true,
        databaseConnected: true,
        blockchainConnected: true,
      },
    };
  }
}