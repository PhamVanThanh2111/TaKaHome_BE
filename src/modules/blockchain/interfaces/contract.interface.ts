/**
 * Blockchain Contract Interface
 * Defines the structure of a rental contract stored on the blockchain
 */

export interface SignatureInfo {
  certSerial: string;
  metadata: any;
  signedBy: string;
  signedAt: string;
  status: 'SIGNED';
}

export interface ContractSignatures {
  lessor?: SignatureInfo;
  lessee?: SignatureInfo;
}

export interface BlockchainContract {
  objectType: 'contract';
  contractId: string;
  lessorId: string;
  lesseeId: string;
  docHash: string;
  rentAmount: number;
  depositAmount: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: 'CREATED' | 'ACTIVE' | 'TERMINATED';
  signatures: ContractSignatures;
  createdBy: string;
  createdByMSP: string;
  createdAt: string;
  updatedAt: string;
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
