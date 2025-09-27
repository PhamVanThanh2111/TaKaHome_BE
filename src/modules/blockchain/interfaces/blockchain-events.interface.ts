/**
 * Blockchain Event Interfaces
 * Defines all event types that can be emitted from the chaincode
 */

// Base blockchain event interface
export interface BaseBlockchainEvent {
  eventName: string;
  timestamp: string;
  blockNumber: number;
  transactionId: string;
  contractId?: string;
}

// Contract lifecycle events
export interface ContractCreatedEvent extends BaseBlockchainEvent {
  eventName: 'ContractCreated';
  contractId: string;
  landlordId: string;
  tenantId: string;
  propertyAddress: string;
  monthlyRent: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
  currency: string;
}

export interface TenantSignedEvent extends BaseBlockchainEvent {
  eventName: 'TenantSigned';
  contractId: string;
  tenantId: string;
  signedAt: string;
  signatureHash: string;
}

export interface DepositRecordedEvent extends BaseBlockchainEvent {
  eventName: 'DepositRecorded';
  contractId: string;
  amount: number;
  paidBy: string;
  orderRef: string;
  paidAt: string;
  currency: string;
}

export interface FirstPaymentRecordedEvent extends BaseBlockchainEvent {
  eventName: 'FirstPaymentRecorded';
  contractId: string;
  amount: number;
  paidBy: string;
  orderRef: string;
  paidAt: string;
  period: number;
  currency: string;
}

// Payment events
export interface PaymentRecordedEvent extends BaseBlockchainEvent {
  eventName: 'PaymentRecorded';
  contractId: string;
  period: number;
  amount: number;
  paidBy: string;
  orderRef: string;
  paidAt: string;
  currency: string;
}

export interface PaymentOverdueEvent extends BaseBlockchainEvent {
  eventName: 'PaymentOverdue';
  contractId: string;
  period: number;
  amount: number;
  dueDate: string;
  overdueAt: string;
  daysPastDue: number;
}

export interface PenaltyAppliedEvent extends BaseBlockchainEvent {
  eventName: 'PenaltyApplied';
  contractId: string;
  paymentId?: string;
  party: 'landlord' | 'tenant';
  amount: number;
  reason: string;
  policyRef: string;
  appliedBy: string;
  appliedAt: string;
}

// Contract status events
export interface ContractActivatedEvent extends BaseBlockchainEvent {
  eventName: 'ContractActivated';
  contractId: string;
  activatedAt: string;
  activatedBy: string;
}

export interface ContractTerminatedEvent extends BaseBlockchainEvent {
  eventName: 'ContractTerminated';
  contractId: string;
  terminatedAt: string;
  terminatedBy: string;
  reason: string;
  earlyTermination: boolean;
}

// Union type for all possible blockchain events
export type BlockchainEvent = 
  | ContractCreatedEvent
  | TenantSignedEvent
  | DepositRecordedEvent
  | FirstPaymentRecordedEvent
  | PaymentRecordedEvent
  | PaymentOverdueEvent
  | PenaltyAppliedEvent
  | ContractActivatedEvent
  | ContractTerminatedEvent;

// Event handler function type
export type EventHandler<T extends BlockchainEvent = BlockchainEvent> = (event: T) => Promise<void>;

// Event listener configuration
export interface EventListenerConfig {
  eventName: string;
  startBlock?: number;
  endBlock?: number;
  replay?: boolean;
  unregister?: boolean;
}

// Event listener result
export interface EventListenerResult {
  eventName: string;
  listenerId: string;
  active: boolean;
  startedAt: string;
}

// Event subscription options
export interface EventSubscriptionOptions {
  contractId?: string;
  eventTypes?: string[];
  fromBlock?: number;
  replay?: boolean;
  autoReconnect?: boolean;
}