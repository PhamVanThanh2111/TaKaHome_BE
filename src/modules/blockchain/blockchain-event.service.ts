/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { 
  BlockchainEvent, 
  EventHandler,
  EventListenerResult,
  EventSubscriptionOptions
} from './interfaces/blockchain-events.interface';
import { Network, Contract } from 'fabric-network';
import { BlockchainEventHandlerService } from './blockchain-event-handler.service';

/**
 * Blockchain Event Service
 * Handles all blockchain event listening and processing using Fabric Network SDK
 */
@Injectable()
export class BlockchainEventService implements OnModuleDestroy {
  private readonly logger = new Logger(BlockchainEventService.name);
  
  // Store active event listeners for cleanup
  private contractListeners: Map<string, any> = new Map();
  private blockListeners: Map<string, any> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private subscribedEventTypes: Set<string> = new Set(); // Track subscribed events
  
  // Network and contract references
  private network: Network | null = null;
  private contract: Contract | null = null;
  private isListening = false;

  constructor(private eventHandlerService: BlockchainEventHandlerService) {}

  /**
   * Initialize event service with network and contract instances
   */
  async initialize(network: Network, contract: Contract): Promise<void> {
    try {
      this.network = network;
      this.contract = contract;
      this.isListening = true;
      
      this.logger.log('✅ Blockchain Event Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Blockchain Event Service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to specific chaincode events
   */
  async subscribeToContractEvents(
    options: EventSubscriptionOptions = {}
  ): Promise<EventListenerResult[]> {
    if (!this.network || !this.contract) {
      throw new Error('Event service not initialized. Call initialize() first.');
    }

    const results: EventListenerResult[] = [];
    const eventTypes = options.eventTypes || [
      'ContractCreated',
      'TenantSigned', 
      'DepositRecorded',
      'FirstPaymentRecorded',
      'PaymentRecorded',
      'PaymentOverdue',
      'PenaltyApplied',
      'ContractActivated',
      'ContractTerminated'
    ];

    for (const eventType of eventTypes) {
      try {
        // Skip if already subscribed to this event type
        if (this.subscribedEventTypes.has(eventType)) {
          this.logger.debug(`⚠️ Already subscribed to ${eventType}, skipping...`);
          continue;
        }

        const listenerId = `contract-${eventType}-${Date.now()}`;
        
        // Create contract event listener using Fabric SDK's contract event listening
        const listener = await this.contract.addContractListener(
          async (event) => {
            await this.handleContractEvent(event, eventType);
          }
        );

        this.contractListeners.set(listenerId, listener);
        this.subscribedEventTypes.add(eventType);

        results.push({
          eventName: eventType,
          listenerId,
          active: true,
          startedAt: new Date().toISOString()
        });

        this.logger.log(`📡 Started listening for ${eventType} events (ID: ${listenerId})`);
      } catch (error) {
        this.logger.error(`Failed to subscribe to ${eventType} events:`, error);
      }
    }

    if (results.length === 0) {
      this.logger.log(`ℹ️ All requested event types already subscribed, no new listeners added`);
    }

    return results;
  }

  /**
   * Subscribe to block events
   */
  async subscribeToBlockEvents(): Promise<EventListenerResult> {
    if (!this.network) {
      throw new Error('Event service not initialized');
    }

    const listenerId = `block-listener-${Date.now()}`;
    
    try {
      const listener = await this.network.addBlockListener(
        async (block) => {
          await this.handleBlockEvent(block);
        }
      );

      this.blockListeners.set(listenerId, listener);

      this.logger.log(`🔗 Started listening for block events (ID: ${listenerId})`);

      return {
        eventName: 'BlockEvent',
        listenerId,
        active: true,
        startedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to subscribe to block events:', error);
      throw error;
    }
  }

  /**
   * Handle contract events from chaincode
   */
  private async handleContractEvent(event: any, eventType: string): Promise<void> {
    try {
      // Parse event payload
      const eventPayload = this.parseEventPayload(event, eventType);
      
      this.logger.log(`📨 Received ${eventType} event:`, {
        contractId: eventPayload.contractId,
        transactionId: event.transactionId,
        blockNumber: event.blockNumber
      });

      // Route to event handler service
      await this.eventHandlerService.handleBlockchainEvent(eventPayload);

      // Call registered handlers for this event type
      const handlers = this.eventHandlers.get(eventType) || [];
      for (const handler of handlers) {
        try {
          await handler(eventPayload);
        } catch (handlerError) {
          this.logger.error(`Error in event handler for ${eventType}:`, handlerError);
        }
      }

      // Log for debugging purposes
      this.logger.debug(`Event ${eventType} processed successfully`, eventPayload);
    } catch (error) {
      this.logger.error(`Error handling ${eventType} event:`, error);
    }
  }

  /**
   * Handle block events
   */
  private async handleBlockEvent(block: any): Promise<void> {
    try {
      this.logger.debug(`📦 New block received: ${block.blockNumber.toString()}`);
      
      // Process block if needed
      const blockInfo = {
        blockNumber: block.blockNumber.toString(),
        timestamp: new Date().toISOString(),
        transactionCount: block.data?.data?.length || 0
      };

      this.logger.debug('Block info:', blockInfo);
    } catch (error) {
      this.logger.error('Error handling block event:', error);
    }
  }

  /**
   * Parse event payload into typed blockchain event
   */
  private parseEventPayload(event: any, eventType: string): BlockchainEvent {
    const baseEvent = {
      eventName: eventType,
      timestamp: new Date().toISOString(),
      blockNumber: event.blockNumber ? parseInt(event.blockNumber.toString()) : 0,
      transactionId: event.transactionId || '',
    };

    try {
      // Parse the event payload (assuming it's JSON)
      const payload = event.payload ? JSON.parse(event.payload.toString()) : {};
      
      return {
        ...baseEvent,
        ...payload
      } as BlockchainEvent;
    } catch (error) {
      this.logger.warn(`Could not parse event payload for ${eventType}:`, error);
      return baseEvent as BlockchainEvent;
    }
  }

  /**
   * Register custom event handler
   */
  registerEventHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    
    this.logger.log(`✅ Registered handler for ${eventType} events`);
  }

  /**
   * Unregister event handler
   */
  unregisterEventHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(eventType, handlers);
      this.logger.log(`✅ Unregistered handler for ${eventType} events`);
    }
  }

  /**
   * Stop listening to all events
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      // Remove all contract listeners
      for (const [listenerId, listener] of this.contractListeners) {
        try {
          if (this.contract && listener) {
            this.contract.removeContractListener(listener);
            this.logger.log(`🛑 Stopped contract listener: ${listenerId}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to remove contract listener ${listenerId}:`, error);
        }
      }

      // Remove all block listeners  
      for (const [listenerId, listener] of this.blockListeners) {
        try {
          if (this.network && listener) {
            this.network.removeBlockListener(listener);
            this.logger.log(`🛑 Stopped block listener: ${listenerId}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to remove block listener ${listenerId}:`, error);
        }
      }

      // Clear maps
      this.contractListeners.clear();
      this.blockListeners.clear();
      this.eventHandlers.clear();
      this.subscribedEventTypes.clear(); // Clear subscribed events tracking
      
      this.isListening = false;
      this.logger.log('🛑 Stopped all blockchain event listeners');
    } catch (error) {
      this.logger.error('Error stopping event listeners:', error);
    }
  }

  /**
   * Get listener status
   */
  getListenerStatus(): {
    isListening: boolean;
    contractListeners: number;
    blockListeners: number;
    eventHandlers: number;
  } {
    return {
      isListening: this.isListening,
      contractListeners: this.contractListeners.size,
      blockListeners: this.blockListeners.size,
      eventHandlers: this.eventHandlers.size
    };
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.stopListening();
    this.logger.log('🧹 Blockchain Event Service destroyed');
  }
}