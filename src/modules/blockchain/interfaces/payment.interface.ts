/**
 * Blockchain Payment Interface
 * Defines the structure of payments and payment schedules on the blockchain
 * Updated for Smart Contract v2.0.0 compatibility
 */

import { PenaltyRecord } from './contract.interface';

export interface PaymentScheduleEntry {
  period: number;
  amount: number;
  dueDate: string;
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE';
}

export interface PaymentSchedule {
  objectType: 'paymentSchedule';
  scheduleId: string;
  contractId: string;
  totalPeriods: number;
  schedule: PaymentScheduleEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  objectType: 'payment';
  paymentId: string;
  contractId: string;
  period: number;
  amount: number; // Integer (cents/đồng)
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE';
  dueDate?: string; // ISO 8601
  orderRef?: string;
  paidAmount?: number; // Integer (cents/đồng)
  paidBy?: string;
  paidAt?: string; // ISO 8601
  overdueAt?: string; // ISO 8601
  penalties?: PenaltyRecord[];
  extensionNumber?: number; // Extension number (null if original period)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Penalty {
  objectType: 'penalty';
  penaltyId?: string;
  contractId: string;
  party?: 'landlord' | 'tenant';
  amount: number; // Integer (cents/đồng)
  reason: string;
  policyRef?: string;
  appliedBy?: string;
  appliedAt?: string; // ISO 8601
  timestamp?: string; // ISO 8601
  status?: 'PENDING' | 'PAID' | 'WAIVED';
}

export interface OverduePayment extends Payment {
  daysPastDue: number;
  penaltyAmount?: number;
}
