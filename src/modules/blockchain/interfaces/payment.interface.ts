/**
 * Blockchain Payment Interface
 * Defines the structure of payments and payment schedules on the blockchain
 */

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
  amount: number;
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE';
  orderRef: string;
  paidAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Penalty {
  objectType: 'penalty';
  penaltyId: string;
  contractId: string;
  penaltyType: 'LATE_PAYMENT' | 'DAMAGE' | 'OTHER';
  amount: number;
  reason: string;
  status: 'PENDING' | 'PAID' | 'WAIVED';
  dueDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverduePayment extends Payment {
  daysPastDue: number;
  penaltyAmount?: number;
}
