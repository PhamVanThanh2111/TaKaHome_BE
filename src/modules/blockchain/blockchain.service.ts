import { Injectable, Logger, OnModuleInit, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { BlockchainConfigService } from './blockchain-config.service';
import { 
  BlockchainContract, 
  ContractHistory, 
  QueryResult 
} from './interfaces/contract.interface';
import { 
  Payment, 
  PaymentSchedule, 
  Penalty, 
  OverduePayment 
} from './interfaces/payment.interface';
import { 
  BlockchainResponse, 
  FabricUser, 
  TransactionResult 
} from './interfaces/fabric.interface';

// Import Fabric Network directly
import { Gateway, Wallets, Contract, Network, X509Identity } from 'fabric-network';
import * as FabricCAServices from 'fabric-ca-client';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Blockchain Service
 * Main service for interacting with Hyperledger Fabric blockchain
 * Direct integration with Fabric Network (no JavaScript wrapper)
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private gateway: Gateway;
  private wallet: any;
  private contract: Contract;
  private network: Network;
  private isInitialized = false;
  private currentOrgName: string | null = null;

  constructor(
    private blockchainConfig: BlockchainConfigService
  ) {}

  /**
   * Initialize the blockchain connection on module start
   */
  async onModuleInit(): Promise<void> {
    try {
      // Skip auto-initialization to avoid connection errors during startup
      // Connection will be established on-demand when needed
      this.logger.log('✅ Blockchain service initialized (enrollment-only mode)');
      this.blockchainConfig.logConfiguration();
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service', error);
      // Don't throw error here to allow application to start
      // Connection will be retried on first request
    }
  }

  /**
   * Initialize Fabric network connection
   */
  private async initializeFabricConnection(orgName: string = 'OrgProp'): Promise<void> {
    try {
      if (this.isInitialized && this.gateway) {
        return;
      }

      const config = this.blockchainConfig.getFabricConfig();
      
      // Initialize wallet
      const walletPath = path.resolve(process.cwd(), './assets/blockchain/wallet');
      this.wallet = await Wallets.newFileSystemWallet(walletPath);
      this.logger.log(`Wallet path: ${walletPath}`);

      const defaultUser = this.blockchainConfig.getDefaultUserForOrg(orgName);
      if (!defaultUser) {
        throw new Error(`No default user found for organization: ${orgName}`);
      }

      // Check if user identity exists in wallet
      const identity = await this.wallet.get(defaultUser);
      if (!identity) {
        throw new Error(`Identity ${defaultUser} not found in wallet. Please enroll user first.`);
      }

      // Load connection profile
      const ccpPath = path.resolve(process.cwd(), './assets/blockchain/connection-profile.json');
      const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
      
      // Override client organization in connection profile dynamically
      const modifiedCcp = { ...ccp };
      modifiedCcp.client.organization = orgName;
      
      // Create gateway connection
      this.gateway = new Gateway();
      const connectionOptions = {
        wallet: this.wallet,
        identity: defaultUser,
        discovery: { enabled: true, asLocalhost: true }
      };

      await this.gateway.connect(modifiedCcp, connectionOptions);
      
      // Get network and contract
      this.network = await this.gateway.getNetwork(config.channelName);
      this.contract = this.network.getContract(config.chaincodeName);
      
      this.isInitialized = true;
      this.logger.log(`Connected to Fabric gateway as ${defaultUser} for organization ${orgName}`);
      this.logger.log(`Blockchain service initialized successfully for ${orgName}`);
    } catch (error) {
      this.logger.error('Failed to initialize Fabric connection:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Ensure connection is ready
   */
  private async ensureConnection(orgName: string = 'OrgProp'): Promise<void> {
    // If not initialized or organization changed, reinitialize connection
    if (!this.isInitialized || this.currentOrgName !== orgName) {
      // Disconnect existing connection if exists
      if (this.gateway) {
        this.gateway.disconnect();
        this.isInitialized = false;
        this.currentOrgName = null;
      }
      
      await this.initializeFabricConnection(orgName);
      this.currentOrgName = orgName;
    }
  }

  /**
   * Disconnect from Fabric gateway
   */
  async disconnect(): Promise<void> {
    if (this.gateway) {
      this.gateway.disconnect();
      this.logger.log('Disconnected from Fabric gateway');
      this.isInitialized = false;
      this.currentOrgName = null;
    }
  }

  /**
   * Enroll a new user for blockchain operations
   */
  async enrollUser(params: {
    userId: string;
    orgName: string;
    role: string;
  }): Promise<boolean> {
    try {
      const walletPath = path.resolve(process.cwd(), './assets/blockchain/wallet');
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      
      // Check if user already exists
      const userExists = await wallet.get(params.userId);
      if (userExists) {
        this.logger.log(`User ${params.userId} already enrolled for ${params.orgName}`);
        return true;
      }

      // Get admin user for the organization
      const adminUserName = `admin-${params.orgName}`;
      const adminUser = await wallet.get(adminUserName);
      
      if (!adminUser) {
        this.logger.warn(`Admin user ${adminUserName} not found in wallet. Cannot enroll user ${params.userId} for ${params.orgName}.`);
        this.logger.warn(`Available admin users in wallet: ${await this.getAvailableAdminUsers(wallet)}`);
        this.logger.warn(`Please ensure ${adminUserName} is enrolled before enrolling other users.`);
        
        // Return false instead of throwing error to allow registration to continue
        return false;
      }

      // Build CA client
      const caInfo = this.buildCAClient(params.orgName);
      if (!caInfo) {
        this.logger.warn(`⚠️ CA information not found for ${params.orgName}. Skipping blockchain enrollment.`);
        this.logger.warn(`This might be because the Fabric CA server is not running.`);
        return false;
      }

      // Get admin user context
      const provider = wallet.getProviderRegistry().getProvider(adminUser.type);
      const adminUserContext = await provider.getUserContext(adminUser, adminUserName);

      // Register the user with CA
      const secret = await caInfo.ca.register(
        {
          enrollmentID: params.userId,
          role: 'client',
          affiliation: `${params.orgName.toLowerCase()}.department1`,
          attrs: [
            { name: 'role', value: params.role, ecert: true },
            { name: 'orgName', value: params.orgName, ecert: true }
          ]
        },
        adminUserContext
      );

      // Enroll the user
      const enrollment = await caInfo.ca.enroll({
        enrollmentID: params.userId,
        enrollmentSecret: secret,
      });

      // Create X509 identity
      const x509Identity: X509Identity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes(),
        },
        mspId: caInfo.mspId,
        type: 'X.509',
      };

      // Store identity in wallet
      await wallet.put(params.userId, x509Identity);
      
      this.logger.log(`✅ Successfully enrolled user ${params.userId} for ${params.orgName} with role ${params.role}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Failed to enroll user ${params.userId}:`, error);
      this.logger.warn(`⚠️ Failed to enroll blockchain identity for user ${params.userId} - continuing without blockchain identity`);
      return false;
    }
  }

  /**
   * Check if user is enrolled in blockchain
   */
  async isUserEnrolled(userId: string): Promise<boolean> {
    try {
      const walletPath = path.resolve(process.cwd(), './assets/blockchain/wallet');
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      
      const identity = await wallet.get(userId);
      return !!identity;
    } catch (error) {
      this.logger.error(`Failed to check enrollment for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Build CA client for organization
   */
  private buildCAClient(orgName: string): { ca: FabricCAServices; mspId: string } | null {
    try {
      this.logger.debug(`Getting organization config for: ${orgName}`);
      const organization = this.blockchainConfig.getOrganization(orgName);
      if (!organization) {
        throw new Error(`Organization ${orgName} not found`);
      }
      
      this.logger.debug(`Organization config:`, organization);

      // Use CA URL from organization config
      const caUrl = organization.caUrl;
      if (!caUrl) {
        throw new Error(`No CA URL found for organization ${orgName}`);
      }
      
      this.logger.debug(`Using CA URL: ${caUrl} for ${orgName}`);

      // Read TLS CA cert for the organization
      const tlsCertPath = path.resolve(process.cwd(), `./assets/blockchain/tls/ca-${orgName.toLowerCase()}.crt`);
      let tlsCACerts = '';
      
      if (fs.existsSync(tlsCertPath)) {
        tlsCACerts = fs.readFileSync(tlsCertPath, 'utf8');
      }

      // Create CA client with proper TLS configuration
      const caOptions: any = { 
        verify: false,
        'ssl-target-name-override': `ca-${orgName.toLowerCase()}`,
        protocol: 'https'
      };
      
      if (tlsCACerts) {
        caOptions.trustedRoots = [tlsCACerts];
      }
      
      const ca = new FabricCAServices(caUrl, caOptions);
      
      return {
        ca,
        mspId: organization.mspId
      };
    } catch (error) {
      this.logger.error(`Failed to build CA client for ${orgName}:`, error);
      return null;
    }
  }

  /**
   * Get list of available admin users in wallet
   */
  private async getAvailableAdminUsers(wallet: any): Promise<string> {
    try {
      const adminUsers: string[] = [];
      const organizations = ['OrgProp', 'OrgTenant', 'OrgLandlord'];
      
      for (const org of organizations) {
        const adminUserName = `admin-${org}`;
        const exists = await wallet.get(adminUserName);
        if (exists) {
          adminUsers.push(adminUserName);
        }
      }
      
      return adminUsers.length > 0 ? adminUsers.join(', ') : 'None';
    } catch (error) {
      return 'Unable to check';
    }
  }

  /**
   * Handle blockchain errors and convert to appropriate HTTP exceptions
   */
  private handleBlockchainError(error: any, operation: string): never {
    this.logger.error(`Blockchain operation failed [${operation}]:`, error);

    const errorMessage = error.message || 'Unknown blockchain error';

    if (errorMessage.includes('Identity not found')) {
      throw new BadRequestException('Blockchain user not enrolled');
    } else if (errorMessage.includes('already exists')) {
      throw new ConflictException('Resource already exists on blockchain');
    } else if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
      throw new NotFoundException('Resource not found on blockchain');
    } else if (errorMessage.includes('Missing required fields')) {
      throw new BadRequestException('Invalid input data for blockchain operation');
    } else {
      throw new InternalServerErrorException(`Blockchain network error: ${errorMessage}`);
    }
  }

  /**
   * Create a wrapper for blockchain operations with error handling
   */
  private async executeBlockchainOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    orgName: string = 'OrgProp'
  ): Promise<BlockchainResponse<T>> {
    try {
      await this.ensureConnection(orgName);
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.logger.debug(`Blockchain operation [${operationName}] completed in ${duration}ms`);
      
      return {
        success: true,
        data: result,
        message: `Operation ${operationName} completed successfully`
      };
    } catch (error) {
      this.logger.error(`Blockchain operation [${operationName}] failed:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        message: `Operation ${operationName} failed`
      };
    }
  }

  // ========== CONTRACT OPERATIONS ==========

  /**
   * Create a new rental contract
   */
  async createContract(
    contractData: {
      contractId: string;
      lessorId: string;
      lesseeId: string;
      docHash?: string;
      rentAmount: number;
      depositAmount?: number;
      currency?: string;
      startDate: string;
      endDate: string;
    },
    user: FabricUser
  ): Promise<BlockchainResponse<BlockchainContract>> {
    
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'CreateContract',
          contractData.contractId,
          contractData.lessorId,
          contractData.lesseeId,
          contractData.docHash || '',
          (contractData.rentAmount || 0).toString(),
          (contractData.depositAmount || 0).toString(),
          contractData.currency || 'VND',
          contractData.startDate,
          contractData.endDate
        );
        
        return JSON.parse(result.toString());
      },
      'createContract',
      user.orgName
    );
  }

  /**
   * Get contract by ID
   */
  async getContract(contractId: string, user: FabricUser): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('GetContract', contractId);
        return JSON.parse(result.toString());
      },
      'getContract',
      user.orgName
    );
  }

  /**
   * Activate contract
   */
  async activateContract(contractId: string, user: FabricUser): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction('ActivateContract', contractId);
        return JSON.parse(result.toString());
      },
      'activateContract',
      user.orgName
    );
  }

  /**
   * Terminate contract
   */
  async terminateContract(contractId: string, reason: string, user: FabricUser): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction('TerminateContract', contractId, reason || '', reason || '');
        return JSON.parse(result.toString());
      },
      'terminateContract',
      user.orgName
    );
  }

  /**
   * Add signature to contract
   */
  async addSignature(
    contractId: string,
    party: string,
    certSerial: string,
    sigMetaJson: string,
    user: FabricUser
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction('AddSignature', contractId, party, certSerial, sigMetaJson);
        return JSON.parse(result.toString());
      },
      'addSignature',
      user.orgName
    );
  }

  /**
   * Get contract history
   */
  async getContractHistory(contractId: string, user: FabricUser): Promise<BlockchainResponse<ContractHistory[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('GetContractHistory', contractId);
        return JSON.parse(result.toString());
      },
      'getContractHistory',
      user.orgName
    );
  }

  // ========== QUERY OPERATIONS ==========

  /**
   * Query contracts by status
   */
  async queryContractsByStatus(status: string, user: FabricUser): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryContractsByStatus', status);
        return JSON.parse(result.toString());
      },
      'queryContractsByStatus',
      user.orgName
    );
  }

  /**
   * Query contracts by party
   */
  async queryContractsByParty(partyId: string, user: FabricUser): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryContractsByParty', partyId);
        return JSON.parse(result.toString());
      },
      'queryContractsByParty',
      user.orgName
    );
  }

  /**
   * Query contracts by date range
   */
  async queryContractsByDateRange(
    startDate: string,
    endDate: string,
    user: FabricUser
  ): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryContractsByDateRange', startDate, endDate);
        return JSON.parse(result.toString());
      },
      'queryContractsByDateRange',
      user.orgName
    );
  }

  // ========== PAYMENT OPERATIONS ==========

  /**
   * Create payment schedule
   */
  async createPaymentSchedule(
    contractId: string,
    scheduleData: {
      totalPeriods: number;
      schedule: Array<{
        period: number;
        amount: number;
        dueDate: string;
      }>;
    },
    user: FabricUser
  ): Promise<BlockchainResponse<PaymentSchedule[]>> {
    return this.executeBlockchainOperation(
      async () => {
        // Chaincode CreatePaymentSchedule expects: contractId, period, amount, orderRef
        // We need to create multiple payment schedules for each period
        const results: any[] = [];
        
        for (const scheduleItem of scheduleData.schedule) {
          const result = await this.contract.submitTransaction(
            'CreatePaymentSchedule',
            contractId,
            scheduleItem.period.toString(),
            scheduleItem.amount.toString(),
            `ORDER_${contractId}_${scheduleItem.period}` // Generate orderRef
          );
          results.push(JSON.parse(result.toString()));
        }
        
        return results;
      },
      'createPaymentSchedule',
      user.orgName
    );
  }

  /**
   * Record payment
   */
  async recordPayment(
    contractId: string,
    period: string,
    amount: number,
    orderRef: string,
    user: FabricUser
  ): Promise<BlockchainResponse<Payment>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction('RecordPayment', contractId, period, amount.toString(), orderRef || '');
        return JSON.parse(result.toString());
      },
      'recordPayment',
      user.orgName
    );
  }

  /**
   * Mark payment as overdue
   */
  async markPaymentOverdue(contractId: string, period: string, user: FabricUser): Promise<BlockchainResponse<Payment>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction('MarkOverdue', contractId, period);
        return JSON.parse(result.toString());
      },
      'markPaymentOverdue',
      user.orgName
    );
  }

  /**
   * Apply penalty
   */
  async applyPenalty(
    contractId: string,
    period: string,
    amount: number,
    reason: string,
    user: FabricUser
  ): Promise<BlockchainResponse<Penalty>> {
    return this.executeBlockchainOperation(
      async () => {
        // Chaincode ApplyPenalty expects: contractId, period, amount, policyRef
        const result = await this.contract.submitTransaction('ApplyPenalty', contractId, period, amount.toString(), reason || '');
        return JSON.parse(result.toString());
      },
      'applyPenalty',
      user.orgName
    );
  }

  /**
   * Query payments by status
   */
  async queryPaymentsByStatus(status: string, user: FabricUser): Promise<BlockchainResponse<Payment[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryPaymentsByStatus', status);
        return JSON.parse(result.toString());
      },
      'queryPaymentsByStatus',
      user.orgName
    );
  }

  /**
   * Query overdue payments
   */
  async queryOverduePayments(user: FabricUser): Promise<BlockchainResponse<OverduePayment[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryOverduePayments');
        return JSON.parse(result.toString());
      },
      'queryOverduePayments',
      user.orgName
    );
  }

  // ========== UTILITY OPERATIONS ==========

  /**
   * Health check for blockchain connection
   */
  async healthCheck(): Promise<{
    status: string;
    network: string;
    isConnected: boolean;
    timestamp: string;
    organizations: string[];
  }> {
    try {
      await this.ensureConnection();
      const config = this.blockchainConfig.getFabricConfig();
      const organizations = Object.keys(this.blockchainConfig.getOrganizations());
      
      return {
        status: 'healthy',
        network: `${config.channelName}/${config.chaincodeName}`,
        isConnected: this.isInitialized,
        timestamp: new Date().toISOString(),
        organizations: organizations
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        network: 'disconnected',
        isConnected: false,
        timestamp: new Date().toISOString(),
        organizations: []
      };
    }
  }

  /**
   * Get supported organizations
   */
  getSupportedOrganizations(): string[] {
    return Object.keys(this.blockchainConfig.getOrganizations());
  }

  /**
   * Get contract penalties
   */
  async getContractPenalties(contractId: string, user: FabricUser): Promise<BlockchainResponse<Penalty[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction('QueryPenaltiesByContract', contractId);
        const rawData = result.toString();
        this.logger.debug(`Raw chaincode response for QueryPenaltiesByContract: ${rawData}`);
        
        const parsedData = JSON.parse(rawData);
        this.logger.debug(`Parsed chaincode response: ${JSON.stringify(parsedData)}`);
        
        return parsedData;
      },
      'getContractPenalties',
      user.orgName
    );
  }
}
