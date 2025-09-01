import { 
  Controller, 
  Get,
  Logger
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse
} from '@nestjs/swagger';

import { BlockchainService } from './blockchain.service';
import { BlockchainConfigService } from './blockchain-config.service';

/**
 * Blockchain Utility Controller
 * Handles health checks and utility operations
 */
@Controller('api/blockchain')
@ApiTags('Blockchain Utilities')
export class BlockchainUtilityController {
  private readonly logger = new Logger(BlockchainUtilityController.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: BlockchainConfigService
  ) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Blockchain health check',
    description: 'Checks the status and connectivity of the blockchain network'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Health check completed',
    schema: {
      example: {
        status: "healthy",
        network: "rentalchannel/real-estate-cc",
        isConnected: true,
        timestamp: "2025-08-28T07:00:00.000Z",
        organizations: ["OrgProp", "OrgTenant", "OrgAgent"]
      }
    }
  })
  async healthCheck() {
    const healthStatus = await this.blockchainService.healthCheck();
    const organizations = this.blockchainService.getSupportedOrganizations();
    
    return {
      ...healthStatus,
      timestamp: new Date().toISOString(),
      organizations
    };
  }

  /**
   * Get supported organizations
   */
  @Get('organizations')
  @ApiOperation({ 
    summary: 'Get supported organizations',
    description: 'Returns list of supported blockchain organizations'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Organizations retrieved successfully',
    schema: {
      example: {
        organizations: [
          {
            name: "OrgProp",
            mspId: "OrgPropMSP",
            users: {
              admin: "admin-OrgProp",
              user: "appUserProp"
            }
          },
          {
            name: "OrgTenant", 
            mspId: "OrgTenantMSP",
            users: {
              admin: "admin-OrgTenant",
              user: "appUserTenant"
            }
          },
          {
            name: "OrgAgent",
            mspId: "OrgAgentMSP", 
            users: {
              admin: "admin-OrgAgent",
              user: "appUserAgent"
            }
          }
        ]
      }
    }
  })
  async getSupportedOrganizations() {
    const organizations = this.configService.getOrganizations();
    
    return {
      organizations: Object.values(organizations)
    };
  }

  /**
   * Get network configuration
   */
  @Get('config')
  @ApiOperation({ 
    summary: 'Get network configuration',
    description: 'Returns current blockchain network configuration (non-sensitive data)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration retrieved successfully',
    schema: {
      example: {
        channelName: "rentalchannel",
        chaincodeName: "real-estate-cc",
        defaultOrg: "OrgProp",
        discoveryAsLocalhost: true,
        supportedOrganizations: ["OrgProp", "OrgTenant", "OrgAgent"]
      }
    }
  })
  async getNetworkConfig() {
    const config = this.configService.getFabricConfig();
    const organizations = this.blockchainService.getSupportedOrganizations();
    
    // Return only non-sensitive configuration data
    return {
      channelName: config.channelName,
      chaincodeName: config.chaincodeName,
      defaultOrg: config.orgName,
      discoveryAsLocalhost: config.discoveryAsLocalhost,
      supportedOrganizations: organizations
    };
  }
}
