/* eslint-disable @typescript-eslint/require-await */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { BlockchainService } from './blockchain.service';
import { BlockchainConfigService } from './blockchain-config.service';
import { JwtBlockchainAuthGuard } from './guards/jwt-blockchain-auth.guard';
import { EnrollUserDto } from './dto/enroll-user.dto';
import { Public } from 'src/common/decorators/public.decorator';

/**
 * Blockchain Utility Controller
 * Handles health checks and utility operations
 */
@Controller('api/blockchain')
@ApiTags('Blockchain Utilities')
@UseGuards(JwtBlockchainAuthGuard)
@ApiBearerAuth()
export class BlockchainUtilityController {
  private readonly logger = new Logger(BlockchainUtilityController.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: BlockchainConfigService,
  ) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  @Public() // Make health check public
  @ApiOperation({
    summary: 'Blockchain health check',
    description: 'Checks the status and connectivity of the blockchain network',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      example: {
        status: 'healthy',
        network: 'rentalchannel/real-estate-cc',
        isConnected: true,
        timestamp: '2025-08-28T07:00:00.000Z',
        organizations: ['OrgProp', 'OrgTenant', 'OrgLandlord'],
      },
    },
  })
  async healthCheck() {
    const healthStatus = await this.blockchainService.healthCheck();
    const organizations = this.blockchainService.getSupportedOrganizations();

    return {
      ...healthStatus,
      timestamp: new Date().toISOString(),
      organizations,
    };
  }

  /**
   * Get supported organizations
   */
  @Get('organizations')
  @Public() // Public endpoint for organization information
  @ApiOperation({
    summary: 'Get supported organizations',
    description: 'Returns list of supported blockchain organizations',
  })
  @ApiResponse({
    status: 200,
    description: 'Organizations retrieved successfully',
    schema: {
      example: {
        organizations: [
          {
            name: 'OrgProp',
            mspId: 'OrgPropMSP',
            users: {
              admin: 'admin-OrgProp',
              user: 'appUserProp',
            },
          },
          {
            name: 'OrgTenant',
            mspId: 'OrgTenantMSP',
            users: {
              admin: 'admin-OrgTenant',
              user: 'appUserTenant',
            },
          },
          {
            name: 'OrgLandlord',
            mspId: 'OrgLandlordMSP',
            users: {
              admin: 'admin-OrgLandlord',
              user: 'appUserLandlord',
            },
          },
        ],
      },
    },
  })
  async getSupportedOrganizations() {
    const organizations = this.configService.getOrganizations();

    return {
      organizations: Object.values(organizations),
    };
  }

  /**
   * Get network configuration
   */
  @Get('config')
  @ApiOperation({
    summary: 'Get network configuration',
    description:
      'Returns current blockchain network configuration (non-sensitive data)',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    schema: {
      example: {
        channelName: 'rentalchannel',
        chaincodeName: 'real-estate-cc',
        defaultOrg: 'OrgProp',
        discoveryAsLocalhost: false,
        supportedOrganizations: ['OrgProp', 'OrgTenant', 'OrgLandlord'],
      },
    },
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
      supportedOrganizations: organizations,
    };
  }

  /**
   * Enroll blockchain user
   */
  @Post('enroll-user')
  @Public() // Public endpoint for user enrollment
  @ApiOperation({
    summary: 'Enroll blockchain user',
    description:
      'Enrolls a user for blockchain operations with specified organization',
  })
  @ApiResponse({
    status: 200,
    description: 'User enrolled successfully',
    schema: {
      example: {
        success: true,
        message: 'User enrolled successfully',
        userId: '123',
        orgName: 'OrgTenant',
        role: 'TENANT',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or user already enrolled',
  })
  async enrollUser(@Body() enrollUserDto: EnrollUserDto) {
    const success = await this.blockchainService.enrollUser(enrollUserDto);

    if (success) {
      return {
        success: true,
        message: 'User enrolled successfully',
        userId: enrollUserDto.userId,
        orgName: enrollUserDto.orgName,
        role: enrollUserDto.role,
      };
    } else {
      return {
        success: false,
        message: 'Failed to enroll user',
        userId: enrollUserDto.userId,
        orgName: enrollUserDto.orgName,
        role: enrollUserDto.role,
      };
    }
  }

  /**
   * Check if user is enrolled
   */
  @Get('check-enrollment')
  @Public() // Make check-enrollment public
  @ApiOperation({
    summary: 'Check user enrollment status',
    description:
      'Checks if a user is enrolled in blockchain for the specified organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Enrollment status retrieved',
    schema: {
      example: {
        userId: '123',
        orgName: 'OrgTenant',
        isEnrolled: true,
        message: 'User is enrolled',
      },
    },
  })
  async checkEnrollment(
    @Query('userId') userId: string,
    @Query('orgName') orgName: string,
  ) {
    const isEnrolled = await this.blockchainService.isUserEnrolled(userId);

    return {
      userId,
      orgName,
      isEnrolled,
      message: isEnrolled ? 'User is enrolled' : 'User is not enrolled',
    };
  }
}
