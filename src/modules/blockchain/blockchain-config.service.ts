import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FabricNetworkConfig, OrganizationConfig } from './interfaces/fabric.interface';

/**
 * Blockchain Configuration Service
 * Manages configuration for Hyperledger Fabric blockchain network
 */
@Injectable()
export class BlockchainConfigService {
  private readonly logger = new Logger(BlockchainConfigService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get Fabric network configuration
   */
  getFabricConfig(): FabricNetworkConfig {
    return {
      channelName: this.configService.get<string>('CHANNEL_NAME', 'rentalchannel'),
      chaincodeName: this.configService.get<string>('CHAINCODE_NAME', 'real-estate-cc'),
      walletPath: this.configService.get<string>('BLOCKCHAIN_WALLET_PATH', './src/modules/blockchain/wallet'),
      orgName: this.configService.get<string>('BLOCKCHAIN_ORG_NAME', 'OrgProp'),
      mspId: this.configService.get<string>('BLOCKCHAIN_MSP_ID', 'OrgPropMSP'),
      discoveryAsLocalhost: this.configService.get<boolean>('DISCOVERY_AS_LOCALHOST', true),
      connectionProfilePath: this.configService.get<string>('CONNECTION_PROFILE_PATH', '../network/connection-profile.json')
    };
  }

  /**
   * Get organization configurations
   */
  getOrganizations(): Record<string, OrganizationConfig> {
    return {
      OrgProp: {
        name: 'OrgProp',
        mspId: 'OrgPropMSP',
        users: {
          admin: 'admin-OrgProp',
          user: 'appUserProp'
        },
        caUrl: this.configService.get<string>('CA_PROP_URL', 'https://localhost:7054')
      },
      OrgTenant: {
        name: 'OrgTenant',
        mspId: 'OrgTenantMSP',
        users: {
          admin: 'admin-OrgTenant',
          user: 'appUserTenant'
        },
        caUrl: this.configService.get<string>('CA_TENANT_URL', 'https://localhost:8054')
      },
      OrgLandlord: {
        name: 'OrgLandlord',
        mspId: 'OrgLandlordMSP',
        users: {
          admin: 'admin-OrgLandlord',
          user: 'appUserLandlord'
        },
        caUrl: this.configService.get<string>('CA_LANDLORD_URL', 'https://localhost:9054')
      }
    };
  }

  /**
   * Get organization config by name
   */
  getOrganization(orgName: string): OrganizationConfig | null {
    const organizations = this.getOrganizations();
    return organizations[orgName] || null;
  }

  /**
   * Get default user for organization
   */
  getDefaultUserForOrg(orgName: string): string | null {
    const org = this.getOrganization(orgName);
    return org ? org.users.admin : null;
  }

  /**
   * Validate organization name
   */
  isValidOrganization(orgName: string): boolean {
    const organizations = this.getOrganizations();
    return !!organizations[orgName];
  }

  /**
   * Get connection profile path
   */
  getConnectionProfilePath(): string {
    const config = this.getFabricConfig();
    return config.connectionProfilePath;
  }

  /**
   * Get wallet path
   */
  getWalletPath(): string {
    const config = this.getFabricConfig();
    return config.walletPath;
  }

  /**
   * Get blockchain network endpoints
   */
  getNetworkEndpoints() {
    return {
      peer: this.configService.get<string>('PEER_ENDPOINT', 'grpcs://localhost:7051'),
      orderer: this.configService.get<string>('ORDERER_ENDPOINT', 'grpcs://localhost:7050'),
      ca: {
        orgProp: this.configService.get<string>('CA_PROP_URL', 'https://localhost:7054'),
        orgTenant: this.configService.get<string>('CA_TENANT_URL', 'https://localhost:8054'),
        orgLandlord: this.configService.get<string>('CA_LANDLORD_URL', 'https://localhost:9054')
      }
    };
  }

  /**
   * Log configuration on startup
   */
  logConfiguration(): void {
    const config = this.getFabricConfig();
    const organizations = Object.keys(this.getOrganizations());
    
    this.logger.log('Blockchain Configuration:');
    this.logger.log(`- Channel: ${config.channelName}`);
    this.logger.log(`- Chaincode: ${config.chaincodeName}`);
    this.logger.log(`- Default Org: ${config.orgName}`);
    this.logger.log(`- Organizations: ${organizations.join(', ')}`);
    this.logger.log(`- Wallet Path: ${config.walletPath}`);
    this.logger.log(`- Discovery as Localhost: ${config.discoveryAsLocalhost}`);
  }
}
