import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { vnNow, addDaysVN } from '../../common/datetime';

/**
 * Automation Event Entity
 * Tracks all automated events in the system for transparency
 */
export enum AutomationEventType {
  PAYMENT_REMINDER_SENT = 'PAYMENT_REMINDER_SENT',
  PAYMENT_OVERDUE_DETECTED = 'PAYMENT_OVERDUE_DETECTED',
  PENALTY_APPLIED = 'PENALTY_APPLIED',
  CONTRACT_EXPIRY_REMINDER = 'CONTRACT_EXPIRY_REMINDER',
  DEPOSIT_REMINDER_SENT = 'DEPOSIT_REMINDER_SENT',
  MAINTENANCE_REMINDER_SENT = 'MAINTENANCE_REMINDER_SENT',
  SYSTEM_CLEANUP_PERFORMED = 'SYSTEM_CLEANUP_PERFORMED',
  BLOCKCHAIN_EVENT_TRIGGERED = 'BLOCKCHAIN_EVENT_TRIGGERED',
}

export enum EventStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  SKIPPED = 'SKIPPED',
}

export interface AutomationEventLog {
  id: string;
  eventType: AutomationEventType;
  status: EventStatus;
  targetEntity: string; // 'booking', 'contract', 'user', etc.
  targetId: string;
  description: string;
  metadata?: Record<string, any>;
  executedAt: Date;
  executionTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Automation Event Logging Service  
 * Provides comprehensive logging and tracking for all automated events
 */
@Injectable()
export class AutomationEventLoggingService {
  private readonly logger = new Logger(AutomationEventLoggingService.name);
  private events: AutomationEventLog[] = []; // In-memory storage for demo

  constructor() {
    // In production, you'd inject a repository for persistent storage
  }

  /**
   * Log an automation event
   */
  async logEvent(
    eventType: AutomationEventType,
    targetEntity: string,
    targetId: string,
    status: EventStatus,
    description: string,
    metadata?: Record<string, any>,
    executionTimeMs?: number,
    errorMessage?: string
  ): Promise<AutomationEventLog> {
    const event: AutomationEventLog = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      status,
      targetEntity,
      targetId,
      description,
      metadata,
      executedAt: vnNow(),
      executionTimeMs,
      errorMessage,
      createdAt: vnNow(),
    };

    // Store in memory (in production, save to database)
    this.events.push(event);

    // Log to console for immediate visibility
    const logLevel = status === EventStatus.FAILED ? 'error' : 
                    status === EventStatus.SUCCESS ? 'log' : 'warn';
    
    this.logger[logLevel](
      `${eventType} - ${status}: ${description}`,
      {
        targetEntity,
        targetId,
        executionTimeMs,
        metadata,
        errorMessage
      }
    );

    return event;
  }

  /**
   * Get automation event history
   */
  async getEventHistory(
    filters?: {
      eventType?: AutomationEventType[];
      status?: EventStatus[];
      targetEntity?: string;
      targetId?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    limit = 100
  ): Promise<AutomationEventLog[]> {
    let filteredEvents = [...this.events];

    if (filters) {
      filteredEvents = filteredEvents.filter(event => {
        if (filters.eventType && !filters.eventType.includes(event.eventType)) return false;
        if (filters.status && !filters.status.includes(event.status)) return false;
        if (filters.targetEntity && event.targetEntity !== filters.targetEntity) return false;
        if (filters.targetId && event.targetId !== filters.targetId) return false;
        if (filters.fromDate && event.executedAt < filters.fromDate) return false;
        if (filters.toDate && event.executedAt > filters.toDate) return false;
        return true;
      });
    }

    // Sort by most recent first
    filteredEvents.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());

    return filteredEvents.slice(0, limit);
  }

  /**
   * Get automation statistics
   */
  async getAutomationStats(days = 7): Promise<{
    totalEvents: number;
    successRate: number;
    eventsByType: Record<string, number>;
    eventsByStatus: Record<string, number>;
    averageExecutionTime: number;
    timeline: Array<{ date: string; count: number }>;
  }> {
    const fromDate = addDaysVN(vnNow(), -days);
    const recentEvents = this.events.filter(event => event.executedAt >= fromDate);

    const totalEvents = recentEvents.length;
    const successfulEvents = recentEvents.filter(e => e.status === EventStatus.SUCCESS).length;
    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    // Group by event type
    const eventsByType: Record<string, number> = {};
    recentEvents.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    });

    // Group by status
    const eventsByStatus: Record<string, number> = {};
    recentEvents.forEach(event => {
      eventsByStatus[event.status] = (eventsByStatus[event.status] || 0) + 1;
    });

    // Calculate average execution time
    const eventsWithTime = recentEvents.filter(e => e.executionTimeMs);
    const averageExecutionTime = eventsWithTime.length > 0 
      ? eventsWithTime.reduce((sum, e) => sum + (e.executionTimeMs || 0), 0) / eventsWithTime.length
      : 0;

    // Create timeline data
    const timeline: Array<{ date: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysVN(vnNow(), -i);
      const dateStr = date.toISOString().split('T')[0];
      const count = recentEvents.filter(e => 
        e.executedAt.toISOString().split('T')[0] === dateStr
      ).length;
      timeline.push({ date: dateStr, count });
    }

    return {
      totalEvents,
      successRate: Math.round(successRate * 100) / 100,
      eventsByType,
      eventsByStatus,
      averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
      timeline,
    };
  }

  /**
   * Get failed events that need attention
   */
  async getFailedEvents(limit = 20): Promise<AutomationEventLog[]> {
    return this.events
      .filter(event => event.status === EventStatus.FAILED)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get events for a specific target
   */
  async getEventsForTarget(
    targetEntity: string, 
    targetId: string
  ): Promise<AutomationEventLog[]> {
    return this.events
      .filter(event => event.targetEntity === targetEntity && event.targetId === targetId)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  /**
   * Performance monitoring helper
   */
  async withPerformanceLogging<T>(
    eventType: AutomationEventType,
    targetEntity: string,
    targetId: string,
    description: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;
      
      await this.logEvent(
        eventType,
        targetEntity,
        targetId,
        EventStatus.SUCCESS,
        description,
        metadata,
        executionTime
      );
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      await this.logEvent(
        eventType,
        targetEntity,
        targetId,
        EventStatus.FAILED,
        description,
        metadata,
        executionTime,
        error instanceof Error ? error.message : String(error)
      );
      
      throw error;
    }
  }

  /**
   * Clear old events (for memory management)
   */
  async cleanupOldEvents(olderThanDays = 30): Promise<number> {
    const cutoffDate = addDaysVN(vnNow(), -olderThanDays);
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => event.executedAt > cutoffDate);
    
    const removedCount = initialCount - this.events.length;
    
    if (removedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${removedCount} old automation events`);
    }
    
    return removedCount;
  }

  /**
   * Generate transparency report
   */
  async generateTransparencyReport(days = 30): Promise<{
    period: string;
    summary: {
      totalEvents: number;
      successRate: number;
      mostCommonEvents: Array<{ type: string; count: number }>;
      systemReliability: string;
    };
    details: {
      paymentReminders: number;
      penaltiesApplied: number;
      contractReminders: number;
      blockchainEvents: number;
      failedOperations: number;
    };
    recommendations: string[];
  }> {
    const stats = await this.getAutomationStats(days);
    const failedEvents = await this.getFailedEvents(100);
    
    // Sort event types by frequency
    const mostCommonEvents = Object.entries(stats.eventsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Calculate system reliability
    const reliability = stats.successRate >= 95 ? 'Excellent' :
                       stats.successRate >= 90 ? 'Good' :
                       stats.successRate >= 80 ? 'Fair' : 'Needs Attention';

    // Generate recommendations
    const recommendations: string[] = [];
    if (stats.successRate < 95) {
      recommendations.push('Investigate and address failed automation events');
    }
    if (stats.averageExecutionTime > 5000) {
      recommendations.push('Optimize performance - average execution time is high');
    }
    if (failedEvents.length > 10) {
      recommendations.push('Multiple failed events detected - review system health');
    }

    return {
      period: `${days} days`,
      summary: {
        totalEvents: stats.totalEvents,
        successRate: stats.successRate,
        mostCommonEvents,
        systemReliability: reliability,
      },
      details: {
        paymentReminders: stats.eventsByType[AutomationEventType.PAYMENT_REMINDER_SENT] || 0,
        penaltiesApplied: stats.eventsByType[AutomationEventType.PENALTY_APPLIED] || 0,
        contractReminders: stats.eventsByType[AutomationEventType.CONTRACT_EXPIRY_REMINDER] || 0,
        blockchainEvents: stats.eventsByType[AutomationEventType.BLOCKCHAIN_EVENT_TRIGGERED] || 0,
        failedOperations: stats.eventsByStatus[EventStatus.FAILED] || 0,
      },
      recommendations,
    };
  }
}