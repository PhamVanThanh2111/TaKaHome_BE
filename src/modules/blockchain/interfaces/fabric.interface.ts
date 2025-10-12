/**
 * Fabric Network Configuration Interface
 * Defines configuration structure for Hyperledger Fabric network connection
 */

export interface FabricNetworkConfig {
  channelName: string;
  chaincodeName: string;
  walletPath: string;
  orgName: string;
  mspId: string;
  discoveryAsLocalhost: boolean;
  connectionProfilePath: string;
}

export interface OrganizationConfig {
  name: string;
  mspId: string;
  users: {
    admin: string;
    user: string;
  };
  caUrl?: string;
}

export interface FabricUser {
  userId: string;
  orgName: string;
  mspId: string;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface BlockchainResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  txId?: string;
}
