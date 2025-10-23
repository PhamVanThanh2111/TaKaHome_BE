/**
 * Blockchain Contract Interface
 * Defines the structure of a rental contract stored on the blockchain
 * Updated for Smart Contract v2.0.0 compatibility
 */

export interface SignatureInfo {
  metadata: any;
  signedBy: string;
  signedAt: string;
  status: 'SIGNED';
}

export interface ContractSignatures {
  landlord?: SignatureInfo;
  tenant?: SignatureInfo;
}

export interface DepositRecord {
  amount: number; // Integer (cents/đồng)
  depositTxRef: string;
  depositedAt: string; // ISO 8601
}

export interface PaymentRecord {
  amount: number; // Integer (cents/đồng)
  paymentTxRef: string;
  paidBy: string;
  paidAt: string; // ISO 8601
}

export interface PenaltyRecord {
  party?: 'landlord' | 'tenant'; // For contract penalties
  amount: number; // Integer (cents/đồng)
  reason: string;
  policyRef?: string;
  appliedBy?: string;
  appliedAt?: string; // ISO 8601
  timestamp?: string; // ISO 8601 (for contract penalties)
}

export interface ExtensionRecord {
  extensionNumber: number;
  previousEndDate: string; // ISO 8601
  newEndDate: string; // ISO 8601
  previousRentAmount: number; // Integer (cents/đồng)
  newRentAmount: number; // Integer (cents/đồng)
  extensionAgreementHash?: string;
  notes?: string;
  recordedBy: string;
  recordedByRole: string;
  recordedAt: string; // ISO 8601
  status: string;
}

export type ContractStatus =
  | 'WAIT_TENANT_SIGNATURE'
  | 'WAIT_DEPOSIT'
  | 'WAIT_FIRST_PAYMENT'
  | 'ACTIVE'
  | 'TERMINATED';

export interface BlockchainContract {
  objectType: 'contract';
  contractId: string;
  landlordId: string;
  tenantId: string;
  landlordMSP: string;
  tenantMSP: string;
  landlordCertId?: string;
  tenantCertId?: string;
  landlordSignedHash: string;
  fullySignedHash?: string;
  rentAmount: number; // Integer (cents/đồng)
  depositAmount: number; // Integer (cents/đồng)
  currency: string;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  status: ContractStatus;
  signatures: ContractSignatures;
  createdBy: string;
  createdByMSP: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  activatedAt?: string; // ISO 8601
  terminatedAt?: string; // ISO 8601
  terminatedBy?: string;
  terminationReason?: string;
  summaryHash?: string;
  deposit: {
    landlord?: DepositRecord;
    tenant?: DepositRecord;
  };
  firstPayment?: PaymentRecord;
  penalties: PenaltyRecord[];

  // Extension fields
  currentExtensionNumber?: number;
  extensions?: ExtensionRecord[];
}

export interface ContractHistory {
  txId: string;
  timestamp: string;
  value: BlockchainContract;
  isDelete: boolean;
}

export interface QueryByDateRangeParams {
  startDate: string;
  endDate: string;
}

export interface QueryResult<T> {
  items: T[];
  total: number;
}
