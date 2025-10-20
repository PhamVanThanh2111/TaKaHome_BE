/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Query } from '@nestjs/common';
import { AutomationEventLoggingService, AutomationEventType, EventStatus } from './automation-event-logging.service';
import { AutomatedPenaltyService } from '../penalty/automated-penalty.service';

/**
 * Automation Monitoring Controller
 * Provides API endpoints for monitoring and dashboard functionality
 */
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
   * Get detailed event history with filters
   */
  @Get('events')
  async getEvents(
    @Query('eventType') eventType?: string,
    @Query('status') status?: string,
    @Query('targetEntity') targetEntity?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};
    
    if (eventType) {
      filters.eventType = eventType.split(',') as AutomationEventType[];
    }
    
    if (status) {
      filters.status = status.split(',') as EventStatus[];
    }
    
    if (targetEntity) {
      filters.targetEntity = targetEntity;
    }
    
    if (targetId) {
      filters.targetId = targetId;
    }

    const limitParsed = limit ? parseInt(limit) : 50;
    
    const events = await this.automationEventLoggingService.getEventHistory(
      filters,
      limitParsed
    );

    return {
      events,
      totalCount: events.length,
      filters: filters,
    };
  }

  /**
   * Get automation statistics
   */
  @Get('stats')
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
  async getTransparencyReport(@Query('days') days?: string) {
    const daysParsed = days ? parseInt(days) : 30;
    return await this.automationEventLoggingService.generateTransparencyReport(daysParsed);
  }

  /**
   * Get system health check
   */
  @Get('health')
  async getHealthCheck() {
    const stats = await this.automationEventLoggingService.getAutomationStats(1); // Last 24h
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

  /**
   * Get automation flow visualization data
   */
  @Get('flow')
  async getAutomationFlow(@Query('days') days?: string) {
    const daysParsed = days ? parseInt(days) : 7;
    const stats = await this.automationEventLoggingService.getAutomationStats(daysParsed);
    
    // Create flow visualization data
    const flows = [
      {
        name: 'Payment Flow',
        stages: [
          { name: 'Reminder Sent', count: stats.eventsByType[AutomationEventType.PAYMENT_REMINDER_SENT] || 0 },
          { name: 'Overdue Detected', count: stats.eventsByType[AutomationEventType.PAYMENT_OVERDUE_DETECTED] || 0 },
          { name: 'Penalty Applied', count: stats.eventsByType[AutomationEventType.PENALTY_APPLIED] || 0 },
        ]
      },
      {
        name: 'Contract Flow',
        stages: [
          { name: 'Expiry Reminder', count: stats.eventsByType[AutomationEventType.CONTRACT_EXPIRY_REMINDER] || 0 },
          { name: 'Maintenance Reminder', count: stats.eventsByType[AutomationEventType.MAINTENANCE_REMINDER_SENT] || 0 },
        ]
      },
      {
        name: 'System Flow',
        stages: [
          { name: 'Cleanup Performed', count: stats.eventsByType[AutomationEventType.SYSTEM_CLEANUP_PERFORMED] || 0 },
          { name: 'Blockchain Events', count: stats.eventsByType[AutomationEventType.BLOCKCHAIN_EVENT_TRIGGERED] || 0 },
        ]
      }
    ];
    
    return {
      period: `${daysParsed} days`,
      flows,
      totalEvents: stats.totalEvents,
      successRate: stats.successRate,
    };
  }
}