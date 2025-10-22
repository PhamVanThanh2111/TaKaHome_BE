/* eslint-disable @typescript-eslint/require-await */
import { 
  Controller, 
  Get, 
  Post,
  Query,
  UseGuards,
  Logger,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiQuery,
  ApiHeader,
  ApiBearerAuth 
} from '@nestjs/swagger';

import { BlockchainEventService } from './blockchain-event.service';
import { JwtBlockchainAuthGuard } from './guards/jwt-blockchain-auth.guard';
import { EventSubscriptionOptions } from './interfaces/blockchain-events.interface';

/**
 * Blockchain Events Controller
 * Handles blockchain event subscription and status endpoints
 */
@Controller('api/blockchain/events')
@ApiTags('Blockchain Events')
@UseGuards(JwtBlockchainAuthGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'orgName',
  description: 'Organization name (OrgProp, OrgTenant, OrgLandlord)',
  required: true,
  example: 'OrgLandlord'
})
@ApiHeader({
  name: 'userId',
  description: 'User identity (optional, uses default if not provided)',
  required: false,
  example: 'admin-OrgLandlord'
})
export class BlockchainEventsController {
  private readonly logger = new Logger(BlockchainEventsController.name);

  constructor(
    private readonly eventService: BlockchainEventService
  ) {}

  /**
   * Get event listener status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get blockchain event listener status',
    description: 'Returns the current status of event listeners including active subscriptions'
  })
  @ApiResponse({
    status: 200,
    description: 'Event listener status retrieved successfully',
    schema: {
      example: {
        isListening: true,
        contractListeners: 9,
        blockListeners: 0,
        eventHandlers: 0,
        startedAt: '2025-09-27T10:30:00Z'
      }
    }
  })
  async getEventStatus() {
    try {
      const status = this.eventService.getListenerStatus();
      
      this.logger.log('📊 Retrieved event listener status', status);
      
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get event status:', error);
      throw error;
    }
  }

  /**
   * Subscribe to contract events (for testing/debugging)
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Subscribe to blockchain events',
    description: 'Subscribe to specific chaincode events. Use for testing or re-subscribing after connection issues.'
  })
  @ApiQuery({
    name: 'eventTypes',
    description: 'Comma-separated list of event types to subscribe to',
    required: false,
    example: 'ContractCreated,PaymentRecorded'
  })
  @ApiQuery({
    name: 'fromBlock',
    description: 'Block number to start listening from',
    required: false,
    type: 'number',
    example: 100
  })
  @ApiQuery({
    name: 'replay',
    description: 'Whether to replay historical events',
    required: false,
    type: 'boolean',
    example: false
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully subscribed to events',
    schema: {
      example: {
        success: true,
        message: 'Successfully subscribed to 9 event types',
        data: {
          subscriptions: [
            {
              eventName: 'ContractCreated',
              listenerId: 'contract-ContractCreated-1695810600000',
              active: true,
              startedAt: '2025-09-27T10:30:00Z'
            }
          ]
        }
      }
    }
  })
  async subscribeToEvents(
    @Query('eventTypes') eventTypesQuery?: string,
    @Query('fromBlock') fromBlock?: number,
    @Query('replay') replay?: boolean
  ) {
    try {
      const options: EventSubscriptionOptions = {};
      
      if (eventTypesQuery) {
        options.eventTypes = eventTypesQuery.split(',').map(type => type.trim());
      }
      
      if (fromBlock) {
        options.fromBlock = fromBlock;
      }
      
      if (replay !== undefined) {
        options.replay = replay;
      }

      const subscriptions = await this.eventService.subscribeToContractEvents(options);
      
      this.logger.log(`📡 Successfully subscribed to ${subscriptions.length} event types`, {
        eventTypes: options.eventTypes,
        fromBlock: options.fromBlock,
        replay: options.replay
      });
      
      return {
        success: true,
        message: `Successfully subscribed to ${subscriptions.length} event types`,
        data: {
          subscriptions,
          options
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to subscribe to events:', error);
      throw error;
    }
  }

  /**
   * Subscribe to block events
   */
  @Post('subscribe/blocks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Subscribe to blockchain block events',
    description: 'Subscribe to new block notifications from the blockchain network'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully subscribed to block events',
    schema: {
      example: {
        success: true,
        message: 'Successfully subscribed to block events',
        data: {
          eventName: 'BlockEvent',
          listenerId: 'block-listener-1695810600000',
          active: true,
          startedAt: '2025-09-27T10:30:00Z'
        }
      }
    }
  })
  async subscribeToBlockEvents() {
    try {
      const subscription = await this.eventService.subscribeToBlockEvents();
      
      this.logger.log('🔗 Successfully subscribed to block events', subscription);
      
      return {
        success: true,
        message: 'Successfully subscribed to block events',
        data: subscription,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to subscribe to block events:', error);
      throw error;
    }
  }

  /**
   * Stop all event listeners
   */
  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop all event listeners',
    description: 'Stop listening to all blockchain events. Use for maintenance or troubleshooting.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully stopped all event listeners',
    schema: {
      example: {
        success: true,
        message: 'All event listeners stopped successfully',
        timestamp: '2025-09-27T10:30:00Z'
      }
    }
  })
  async stopEventListeners() {
    try {
      await this.eventService.stopListening();
      
      this.logger.log('🛑 All event listeners stopped by user request');
      
      return {
        success: true,
        message: 'All event listeners stopped successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to stop event listeners:', error);
      throw error;
    }
  }

  /**
   * Get supported event types
   */
  @Get('types')
  @ApiOperation({
    summary: 'Get supported blockchain event types',
    description: 'Returns a list of all blockchain event types that can be subscribed to'
  })
  @ApiResponse({
    status: 200,
    description: 'Supported event types retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          contractEvents: [
            'ContractCreated',
            'TenantSigned',
            'DepositRecorded',
            'FirstPaymentRecorded',
            'PaymentRecorded',
            'PaymentOverdue',
            'PenaltyApplied',
            'ContractActivated',
            'ContractTerminated'
          ],
          blockEvents: ['BlockEvent']
        }
      }
    }
  })
  async getSupportedEventTypes() {
    try {
      const eventTypes = {
        contractEvents: [
          'ContractCreated',
          'TenantSigned',
          'DepositRecorded',
          'FirstPaymentRecorded',
          'PaymentRecorded',
          'PaymentOverdue',
          'PenaltyApplied',
          'ContractActivated',
          'ContractTerminated'
        ],
        blockEvents: ['BlockEvent']
      };
      
      return {
        success: true,
        data: eventTypes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get supported event types:', error);
      throw error;
    }
  }
}