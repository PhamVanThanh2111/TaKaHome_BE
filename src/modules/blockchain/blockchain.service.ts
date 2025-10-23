/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BlockchainConfigService } from './blockchain-config.service';
import { BlockchainEventService } from './blockchain-event.service';
import {
  BlockchainContract,
  ContractHistory,
} from './interfaces/contract.interface';
import {
  Payment,
  PaymentSchedule,
  Penalty,
  OverduePayment,
} from './interfaces/payment.interface';
import { BlockchainResponse, FabricUser } from './interfaces/fabric.interface';

// Import Fabric Network directly
import {
  Gateway,
  Wallets,
  Contract,
  Network,
  X509Identity,
  Identity,
} from 'fabric-network';
import FabricCAServices from 'fabric-ca-client';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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
  private currentUserId: string | null = null;
  private eventListenersStarted = false;

  constructor(
    private blockchainConfig: BlockchainConfigService,
    private eventService: BlockchainEventService,
  ) {}

  /**
   * Initialize the blockchain connection on module start
   */
  async onModuleInit(): Promise<void> {
    try {
      // Skip auto-initialization to avoid connection errors during startup
      // Connection will be established on-demand when needed
      this.logger.log(
        '✅ Blockchain service initialized (enrollment-only mode)',
      );
      this.blockchainConfig.logConfiguration();
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service', error);
      // Don't throw error here to allow application to start
      // Connection will be retried on first request
    }
  }

  /**
   * Load user identity directly from wallet and ensure it's properly formatted
   */
  private async loadUserIdentityDirectly(
    userId: string,
  ): Promise<Identity | null> {
    try {
      const walletPath = path.join(
        process.cwd(),
        'assets',
        'blockchain',
        'wallet',
      );
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      // Get the raw identity from wallet
      const rawIdentity = await wallet.get(userId);
      if (!rawIdentity) {
        this.logger.warn(`User identity ${userId} not found in wallet`);
        return null;
      }

      // Parse the identity data
      const identityData = rawIdentity as any;

      // Create X.509 identity directly from wallet data
      const x509Identity = {
        credentials: {
          certificate: identityData.credentials.certificate,
          privateKey: identityData.credentials.privateKey,
        },
        mspId: identityData.mspId,
        type: 'X.509',
      };

      // Store the properly formatted identity back to wallet
      await wallet.put(userId, x509Identity);

      this.logger.log(
        `Successfully loaded and formatted identity for user: ${userId}`,
      );
      return x509Identity;
    } catch (error) {
      this.logger.error(
        `Failed to load user identity directly: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Initialize connection to Fabric network
   */
  private async initializeFabricConnection(
    orgName: string,
    userId?: string,
  ): Promise<boolean> {
    try {
      const connectionProfile = path.join(
        process.cwd(),
        'assets',
        'blockchain',
        'connection-profile.json',
      );
      const ccp = JSON.parse(fs.readFileSync(connectionProfile, 'utf8'));

      const walletPath = path.join(
        process.cwd(),
        'assets',
        'blockchain',
        'wallet',
      );
      this.wallet = await Wallets.newFileSystemWallet(walletPath);

      // Determine which identity to use
      let identityLabel: string;

      // If userId is provided, try to load it directly first
      if (userId) {
        const directIdentity = await this.loadUserIdentityDirectly(userId);
        if (directIdentity) {
          identityLabel = userId;
          this.logger.log(`Using user identity: ${userId}`);
        } else {
          this.logger.warn(
            `Could not load user identity ${userId}, falling back to admin`,
          );
          identityLabel = this.getDefaultUser(orgName);
        }
      } else {
        identityLabel = this.getDefaultUser(orgName);
      }

      const identity = await this.wallet.get(identityLabel);
      if (!identity) {
        this.logger.error(`❌ Identity ${identityLabel} not found in wallet`);
        return false;
      }

      this.gateway = new Gateway();
      await this.gateway.connect(ccp, {
        wallet: this.wallet,
        identity: identityLabel,
        discovery: { enabled: false, asLocalhost: false },
      });

      const fabricConfig = this.blockchainConfig.getFabricConfig();
      const channelName = fabricConfig.channelName;
      const chaincodeName = fabricConfig.chaincodeName;

      this.network = await this.gateway.getNetwork(channelName);
      this.contract = this.network.getContract(chaincodeName);

      // Initialize event service with network and contract
      await this.eventService.initialize(this.network, this.contract);

      // Start listening for blockchain events only if not already started
      if (!this.eventListenersStarted) {
        await this.startEventListeners();
        this.eventListenersStarted = true;
      }

      this.logger.log(`Connected to Fabric network as ${identityLabel}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to initialize Fabric connection: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Start blockchain event listeners
   */
  private async startEventListeners(): Promise<void> {
    try {
      // Subscribe to contract events
      const contractListeners =
        await this.eventService.subscribeToContractEvents();
      this.logger.log(
        `✅ Started ${contractListeners.length} contract event listeners`,
      );

      // Subscribe to block events (optional)
      // const blockListener = await this.eventService.subscribeToBlockEvents();
      // this.logger.log(`✅ Started block event listener: ${blockListener.listenerId}`);
    } catch (error) {
      this.logger.error('Failed to start event listeners:', error);
      // Don't throw error here to avoid blocking the connection initialization
    }
  }

  /**
   * Ensure connection is ready
   */
  private async ensureConnection(
    orgName: string = 'OrgProp',
    userId?: string,
  ): Promise<void> {
    // If not initialized or organization changed or user changed, reinitialize connection
    if (
      !this.isInitialized ||
      this.currentOrgName !== orgName ||
      this.currentUserId !== userId
    ) {
      // Disconnect existing connection if exists
      if (this.gateway) {
        this.gateway.disconnect();
        this.isInitialized = false;
        this.currentOrgName = null;
        this.currentUserId = null;
        // Note: Keep event listeners running if they were started
        // They will be reinitialized with the new connection
      }

      const success = await this.initializeFabricConnection(orgName, userId);
      if (success) {
        this.isInitialized = true;
        this.currentOrgName = orgName;
        this.currentUserId = userId || null;
      } else {
        throw new Error('Failed to initialize blockchain connection');
      }
    }
  }

  /**
   * Disconnect from Fabric gateway
   */
  async disconnect(): Promise<void> {
    // Stop event listeners first
    await this.eventService.stopListening();
    this.eventListenersStarted = false;

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
      const walletPath = path.resolve(
        process.cwd(),
        './assets/blockchain/wallet',
      );
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      // Check if user already exists
      const userExists = await wallet.get(params.userId);
      if (userExists) {
        this.logger.log(
          `✅ User ${params.userId} already enrolled for ${params.orgName}`,
        );
        return true;
      }

      // Validate organization name
      if (!this.blockchainConfig.isValidOrganization(params.orgName)) {
        this.logger.warn(
          `❌ Invalid organization name: ${params.orgName}. Valid orgs: OrgProp, OrgTenant, OrgLandlord`,
        );
        return false;
      }

      // Build CA client
      const caInfo = this.buildCAClient(params.orgName);
      if (!caInfo) {
        this.logger.warn(
          `⚠️ CA information not found for ${params.orgName}. Skipping blockchain enrollment.`,
        );
        this.logger.warn(
          `� This might be because the Fabric CA server is not running.`,
        );
        this.logger.warn(
          `💡 Please check if CA containers are running: docker ps | grep ca`,
        );
        return false;
      }

      // Try to enroll with bootstrap admin first and then register user
      let adminUserContext;
      try {
        // Use bootstrap admin (admin/adminpw) to register new users
        const bootstrapEnrollment = await caInfo.ca.enroll({
          enrollmentID: 'admin',
          enrollmentSecret: 'adminpw',
        });

        // Create temporary admin identity in memory
        const tempAdminIdentity = {
          credentials: {
            certificate: bootstrapEnrollment.certificate,
            privateKey: bootstrapEnrollment.key.toBytes(),
          },
          mspId: caInfo.mspId,
          type: 'X.509',
        };

        // Get admin context from bootstrap enrollment
        const provider = wallet
          .getProviderRegistry()
          .getProvider(tempAdminIdentity.type);
        adminUserContext = await provider.getUserContext(
          tempAdminIdentity,
          'admin',
        );
        this.logger.log(
          `✅ Successfully got bootstrap admin context for ${params.orgName}`,
        );
      } catch (bootstrapError) {
        this.logger.error(
          `❌ Failed to get bootstrap admin context: ${bootstrapError.message}`,
        );
        return false;
      }

      // Determine affiliation based on organization
      const affiliation = this.getAffiliationForOrg(params.orgName);

      // Generate a cryptographically secure random password
      const userSecret = crypto.randomBytes(32).toString('hex');

      // Register the user with CA using bootstrap admin
      const isProduction = process.env.NODE_ENV === 'production';
      const maxEnrollments = isProduction ? 1 : 0; // 0 = unlimited for dev, 1 for production

      let secret;
      try {
        secret = await caInfo.ca.register(
          {
            enrollmentID: params.userId,
            enrollmentSecret: userSecret,
            role: 'client',
            affiliation: affiliation,
            maxEnrollments: maxEnrollments,
            attrs: [
              { name: 'role', value: params.role, ecert: true },
              { name: 'orgName', value: params.orgName, ecert: true },
            ],
          },
          adminUserContext,
        );
        this.logger.log(
          `✅ Successfully registered user ${params.userId} with CA`,
        );
      } catch (regError) {
        if (
          regError.message &&
          regError.message.includes('already registered')
        ) {
          this.logger.log(
            `⚠️ User ${params.userId} already registered, trying to enroll with default secret`,
          );
          secret = userSecret;
        } else {
          this.logger.error(
            `❌ Failed to register user ${params.userId}: ${regError.message}`,
          );
          return false;
        }
      }

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

      this.logger.log(
        `✅ Successfully enrolled user ${params.userId} for ${params.orgName} with role ${params.role}`,
      );
      this.logger.log(
        `📋 User ${params.userId} can now participate in blockchain transactions`,
      );
      return true;
    } catch (error) {
      // Handle specific error cases
      if (error.message && error.message.includes('already enrolled')) {
        this.logger.warn(
          `⚠️ User ${params.userId} is already enrolled with the CA for ${params.orgName}`,
        );
        return true;
      }

      // Categorize errors for better debugging
      if (error.message && error.message.includes('ECONNREFUSED')) {
        this.logger.error(
          `🚫 CA server not accessible for ${params.orgName}. Check if CA containers are running.`,
        );
      } else if (error.message && error.message.includes('certificate')) {
        this.logger.error(
          `🔒 TLS certificate issue for ${params.orgName}. Check certificate validity.`,
        );
      } else if (
        error.message &&
        error.message.includes('Authentication failure')
      ) {
        this.logger.error(
          `🔑 Authentication failed for ${params.orgName}. Check admin credentials.`,
        );
      } else if (error.message && error.message.includes('affiliation')) {
        this.logger.error(
          `🏢 Affiliation not found for ${params.orgName}. Check organization setup.`,
        );
      } else {
        this.logger.error(
          `❌ Failed to enroll user ${params.userId} for ${params.orgName}:`,
          {
            error: error.message,
            // Only log stack trace in development
            ...(process.env.NODE_ENV !== 'production' && {
              stack: error.stack,
            }),
          },
        );
      }

      this.logger.warn(
        `⚠️ Failed to enroll blockchain identity for user ${params.userId} - continuing without blockchain identity`,
      );
      return false;
    }
  }

  /**
   * Check if user is enrolled in blockchain
   */
  async isUserEnrolled(userId: string): Promise<boolean> {
    try {
      const walletPath = path.resolve(
        process.cwd(),
        './assets/blockchain/wallet',
      );
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      const identity = await wallet.get(userId);
      return !!identity;
    } catch (error) {
      this.logger.error(
        `Failed to check enrollment for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Build CA client for organization
   */
  private buildCAClient(
    orgName: string,
  ): { ca: FabricCAServices; mspId: string } | null {
    try {
      const organization = this.blockchainConfig.getOrganization(orgName);
      if (!organization) {
        throw new Error(`Organization ${orgName} not found`);
      }

      // Use CA URL from organization config
      const caUrl = organization.caUrl;
      if (!caUrl) {
        throw new Error(`No CA URL found for organization ${orgName}`);
      }

      // Read TLS CA cert for the organization
      const tlsCertPath = path.resolve(
        process.cwd(),
        `./assets/blockchain/tls/ca-${orgName.toLowerCase()}.crt`,
      );
      let tlsCACerts = '';

      if (fs.existsSync(tlsCertPath)) {
        tlsCACerts = fs.readFileSync(tlsCertPath, 'utf8');
      }

      // Create CA client with proper TLS configuration
      const isProduction = process.env.NODE_ENV === 'production';
      const caOptions: any = {
        verify: isProduction, // Enable TLS verification in production
        'ssl-target-name-override': `ca-${orgName.toLowerCase()}`,
        protocol: 'https',
      };

      if (tlsCACerts) {
        caOptions.trustedRoots = [tlsCACerts];
      }

      // Log TLS configuration for security audit
      this.logger.log(
        `🔒 TLS verification ${isProduction ? 'ENABLED' : 'DISABLED'} for ${orgName} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`,
      );

      const ca = new FabricCAServices(caUrl, caOptions);

      return {
        ca,
        mspId: organization.mspId,
      };
    } catch (error) {
      this.logger.error(`Failed to build CA client for ${orgName}:`, error);
      return null;
    }
  }

  /**
   * Get default admin user for organization
   */
  private getDefaultUser(orgName: string): string {
    return `admin-${orgName}`;
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

      return adminUsers.length > 0
        ? adminUsers.join(', ')
        : 'No admin users found';
    } catch {
      return 'Error checking admin users';
    }
  }

  /**
   * Get affiliation for organization
   */
  private getAffiliationForOrg(orgName: string): string {
    const affiliations = {
      OrgProp: 'orgProp.department1',
      OrgTenant: 'orgTenant.department1',
      OrgLandlord: 'orgLandlord.department1',
    };
    return affiliations[orgName] || `${orgName}.department1`;
  } /**
   * Handle blockchain errors and convert to appropriate HTTP exceptions
   */
  private handleBlockchainError(error: any, operation: string): never {
    this.logger.error(`Blockchain operation failed [${operation}]:`, error);

    const errorMessage = error.message || 'Unknown blockchain error';

    if (errorMessage.includes('Identity not found')) {
      throw new BadRequestException('Blockchain user not enrolled');
    } else if (errorMessage.includes('already exists')) {
      throw new ConflictException('Resource already exists on blockchain');
    } else if (
      errorMessage.includes('does not exist') ||
      errorMessage.includes('not found')
    ) {
      throw new NotFoundException('Resource not found on blockchain');
    } else if (errorMessage.includes('Missing required fields')) {
      throw new BadRequestException(
        'Invalid input data for blockchain operation',
      );
    } else {
      throw new InternalServerErrorException(
        `Blockchain network error: ${errorMessage}`,
      );
    }
  }

  /**
   * Create a wrapper for blockchain operations with error handling
   */
  private async executeBlockchainOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    orgName: string = 'OrgProp',
    userId?: string,
  ): Promise<BlockchainResponse<T>> {
    try {
      await this.ensureConnection(orgName, userId);

      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      this.logger.log(
        `Blockchain operation [${operationName}] completed in ${duration}ms for user ${userId || 'admin'}`,
      );

      return {
        success: true,
        data: result,
        message: `Operation ${operationName} completed successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Blockchain operation [${operationName}] failed:`,
        error,
      );
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        message: `Operation ${operationName} failed`,
      };
    }
  }

  // ========== CONTRACT OPERATIONS ==========

  /**
   * Create a new rental contract (landlord initiates)
   */
  async createContract(
    contractData: {
      contractId: string;
      landlordId: string;
      tenantId: string;
      landlordMSP: string;
      tenantMSP: string;
      landlordCertId: string;
      tenantCertId: string;
      signedContractFileHash: string;
      landlordSignatureMeta: string;
      rentAmount: string;
      depositAmount: string;
      currency: string;
      startDate: string;
      endDate: string;
    },
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'CreateContract',
          contractData.contractId,
          contractData.landlordId,
          contractData.tenantId,
          contractData.landlordMSP,
          contractData.tenantMSP,
          contractData.landlordCertId,
          contractData.tenantCertId,
          contractData.signedContractFileHash,
          contractData.landlordSignatureMeta,
          contractData.rentAmount,
          contractData.depositAmount,
          contractData.currency,
          contractData.startDate,
          contractData.endDate,
        );

        return JSON.parse(result.toString());
      },
      'createContract',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Get contract by ID
   */
  async getContract(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'GetContract',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'getContract',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Activate contract
   */
  async activateContract(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'ActivateContract',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'activateContract',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Terminate contract
   */
  async terminateContract(
    contractId: string,
    reason: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'TerminateContract',
          contractId,
          reason || '',
          reason || '',
        );
        return JSON.parse(result.toString());
      },
      'terminateContract',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Tenant signs the contract
   */
  async tenantSignContract(
    contractId: string,
    fullySignedContractFileHash: string,
    tenantSignatureMeta: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'TenantSignContract',
          contractId,
          fullySignedContractFileHash,
          tenantSignatureMeta,
        );
        return JSON.parse(result.toString());
      },
      'tenantSignContract',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Record security deposits from both parties
   */
  async recordDeposit(
    contractId: string,
    party: string,
    amount: string,
    depositTxRef: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'RecordDeposit',
          contractId,
          party,
          amount,
          depositTxRef,
        );
        return JSON.parse(result.toString());
      },
      'recordDeposit',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Record the first month's rent payment
   */
  async recordFirstPayment(
    contractId: string,
    amount: string,
    paymentTxRef: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'RecordFirstPayment',
          contractId,
          amount,
          paymentTxRef,
        );
        return JSON.parse(result.toString());
      },
      'recordFirstPayment',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Generate monthly payment schedule based on first payment date
   */
  async createMonthlyPaymentSchedule(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<any[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'CreateMonthlyPaymentSchedule',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'createMonthlyPaymentSchedule',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Add signature to contract (legacy function - deprecated)
   */
  async addSignature(
    contractId: string,
    party: string,
    certSerial: string,
    sigMetaJson: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'AddSignature',
          contractId,
          party,
          certSerial,
          sigMetaJson,
        );
        return JSON.parse(result.toString());
      },
      'addSignature',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Get contract history
   */
  async getContractHistory(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<ContractHistory[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'GetContractHistory',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'getContractHistory',
      user.orgName,
      user.userId,
    );
  }

  // ========== QUERY OPERATIONS ==========

  /**
   * Query contracts by status
   */
  async queryContractsByStatus(
    status: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryContractsByStatus',
          status,
        );
        return JSON.parse(result.toString());
      },
      'queryContractsByStatus',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query contracts by party
   */
  async queryContractsByParty(
    partyId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryContractsByParty',
          partyId,
        );
        return JSON.parse(result.toString());
      },
      'queryContractsByParty',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query contracts by date range
   */
  async queryContractsByDateRange(
    startDate: string,
    endDate: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryContractsByDateRange',
          startDate,
          endDate,
        );
        return JSON.parse(result.toString());
      },
      'queryContractsByDateRange',
      user.orgName,
      user.userId,
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
    user: FabricUser,
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
            `ORDER_${contractId}_${scheduleItem.period}`, // Generate orderRef
          );
          results.push(JSON.parse(result.toString()));
        }

        return results;
      },
      'createPaymentSchedule',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Record monthly rent payment
   */
  async recordPayment(
    contractId: string,
    period: string,
    amount: string,
    user: FabricUser,
    orderRef?: string,
  ): Promise<BlockchainResponse<Payment>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'RecordPayment',
          contractId,
          period,
          amount,
          orderRef || '',
        );
        return JSON.parse(result.toString());
      },
      'recordPayment',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Mark payment as overdue (automatic based on due date)
   */
  async markOverdue(
    contractId: string,
    period: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Payment>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'MarkOverdue',
          contractId,
          period,
        );
        return JSON.parse(result.toString());
      },
      'markOverdue',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Apply penalty to a specific payment
   */
  async applyPenalty(
    contractId: string,
    period: string,
    amount: string,
    policyRef: string,
    reason: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Penalty>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'ApplyPenalty',
          contractId,
          period,
          amount,
          policyRef || '',
          reason,
        );
        return JSON.parse(result.toString());
      },
      'applyPenalty',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Record contract-level penalty
   */
  async recordPenalty(
    contractId: string,
    party: string,
    amount: string,
    reason: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Penalty>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'RecordPenalty',
          contractId,
          party,
          amount,
          reason,
        );
        return JSON.parse(result.toString());
      },
      'recordPenalty',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query payments by status
   */
  async queryPaymentsByStatus(
    status: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Payment[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryPaymentsByStatus',
          status,
        );
        return JSON.parse(result.toString());
      },
      'queryPaymentsByStatus',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query overdue payments
   */
  async queryOverduePayments(
    user: FabricUser,
  ): Promise<BlockchainResponse<OverduePayment[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryOverduePayments',
        );
        return JSON.parse(result.toString());
      },
      'queryOverduePayments',
      user.orgName,
      user.userId,
    );
  }

  // ========== PRIVATE DATA OPERATIONS ==========

  /**
   * Store sensitive contract details in private data collection
   */
  async storeContractPrivateDetails(
    contractId: string,
    privateDataJson: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<any>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'StoreContractPrivateDetails',
          contractId,
          privateDataJson,
        );
        return JSON.parse(result.toString());
      },
      'storeContractPrivateDetails',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Retrieve private contract details
   */
  async getContractPrivateDetails(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<any>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'GetContractPrivateDetails',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'getContractPrivateDetails',
      user.orgName,
      user.userId,
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
      const organizations = Object.keys(
        this.blockchainConfig.getOrganizations(),
      );

      return {
        status: 'healthy',
        network: `${config.channelName}/${config.chaincodeName}`,
        isConnected: this.isInitialized,
        timestamp: new Date().toISOString(),
        organizations: organizations,
      };
    } catch (error) {
      this.logger.error('Blockchain health check failed:', error.message);
      return {
        status: 'unhealthy',
        network: 'disconnected',
        isConnected: false,
        timestamp: new Date().toISOString(),
        organizations: [],
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
  async getContractPenalties(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Penalty[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryPenaltiesByContract',
          contractId,
        );
        const rawData = result.toString();
        const parsedData = JSON.parse(rawData);

        return parsedData;
      },
      'getContractPenalties',
      user.orgName,
      user.userId,
    );
  }

  // ========== CONTRACT EXTENSION OPERATIONS ==========

  /**
   * Record contract extension
   */
  async recordContractExtension(
    contractId: string,
    newEndDate: string,
    newRentAmount: string,
    extensionAgreementHash: string,
    extensionNotes: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'RecordContractExtension',
          contractId,
          newEndDate,
          newRentAmount,
          extensionAgreementHash || '',
          extensionNotes || '',
        );
        return JSON.parse(result.toString());
      },
      'recordContractExtension',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Create payment schedule for extension period
   */
  async createExtensionPaymentSchedule(
    contractId: string,
    extensionNumber: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<Payment[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.submitTransaction(
          'CreateExtensionPaymentSchedule',
          contractId,
          extensionNumber,
        );
        return JSON.parse(result.toString());
      },
      'createExtensionPaymentSchedule',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query contract extensions history
   */
  async queryContractExtensions(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<any>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryContractExtensions',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'queryContractExtensions',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Get active extension for a contract
   */
  async getActiveExtension(
    contractId: string,
    user: FabricUser,
  ): Promise<BlockchainResponse<any>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'GetActiveExtension',
          contractId,
        );
        return JSON.parse(result.toString());
      },
      'getActiveExtension',
      user.orgName,
      user.userId,
    );
  }

  /**
   * Query all contracts with extensions
   */
  async queryContractsWithExtensions(
    user: FabricUser,
  ): Promise<BlockchainResponse<BlockchainContract[]>> {
    return this.executeBlockchainOperation(
      async () => {
        const result = await this.contract.evaluateTransaction(
          'QueryContractsWithExtensions',
        );
        return JSON.parse(result.toString());
      },
      'queryContractsWithExtensions',
      user.orgName,
      user.userId,
    );
  }
}
