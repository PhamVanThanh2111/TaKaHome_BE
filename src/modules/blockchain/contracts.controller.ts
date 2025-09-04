import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  Logger,
  HttpStatus,
  HttpCode,
  UnauthorizedException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
  ApiHeader,
  ApiBearerAuth 
} from '@nestjs/swagger';

import { BlockchainService } from './blockchain.service';
import { JwtBlockchainAuthGuard, BlockchainUser } from './guards/jwt-blockchain-auth.guard';
import { 
  CreateBlockchainContractDto, 
  AddSignatureDto, 
  QueryContractsDto, 
  TerminateContractDto 
} from './dto/contract.dto';
import { FabricUser } from './interfaces/fabric.interface';
import { CurrentUser } from '../../common/decorators/user.decorator';

/**
 * Contracts Controller
 * Handles all blockchain contract operations
 */
@Controller('api/blockchain/contracts')
@ApiTags('Blockchain Contracts')
@UseGuards(JwtBlockchainAuthGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'orgName',
  description: 'Organization name (OrgProp, OrgTenant, OrgLandlord)',
  required: true,
  example: 'OrgProp'
})
@ApiHeader({
  name: 'userId',
  description: 'User identity (optional, uses default if not provided)',
  required: false,
  example: 'admin-OrgProp'
})
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Create a new rental contract
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new rental contract',
    description: 'Creates a new rental contract on the blockchain with the specified details. Must be called by landlord/property owner using OrgProp or OrgLandlord organization.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Contract created successfully',
    schema: {
      example: {
        success: true,
        data: {
          objectType: "contract",
          contractId: "CONTRACT_001",
          lessorId: "LANDLORD_001",
          lesseeId: "TENANT_001",
          rentAmount: 15000000,
          depositAmount: 30000000,
          currency: "VND",
          startDate: "2025-01-01T00:00:00.000Z",
          endDate: "2025-12-31T23:59:59.999Z",
          status: "CREATED",
          signatures: {},
          createdAt: "2025-08-28T07:00:00.000Z"
        },
        message: "Operation createContract completed successfully"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Contract already exists' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async createContract(
    @Body() createContractDto: CreateBlockchainContractDto,
    @BlockchainUser() blockchainUser: FabricUser,
    @CurrentUser() jwtUser: any
  ) {
    this.logger.log(
      `Creating contract: ${createContractDto.contractId} for org: ${blockchainUser.orgName} by user: ${jwtUser.email || jwtUser.id}`
    );
    
    // Verify user authorization (additional business logic)
    this.verifyContractCreationPermission(createContractDto, jwtUser, blockchainUser);
    
    const result = await this.blockchainService.createContract(createContractDto, blockchainUser);
    
    if (!result.success) {
      this.logger.error(`Failed to create contract: ${result.error}`);
    } else {
      this.logger.log(`Contract created successfully by ${jwtUser.email || jwtUser.id}`);
    }
    
    return result;
  }

  /**
   * Verify if user has permission to create contract
   */
  private verifyContractCreationPermission(
    contractDto: CreateBlockchainContractDto, 
    jwtUser: any, 
    blockchainUser: FabricUser
  ) {
    // Get user roles
    const userRoles = this.getUserRoles(jwtUser);
    
    // Only landlords/property owners can create contracts
    if (!userRoles.includes('LANDLORD') && !userRoles.includes('PROPERTY_OWNER') && !userRoles.includes('ADMIN')) {
      throw new UnauthorizedException(
        `Only landlords or property owners can create contracts. User roles: ${userRoles.join(', ')}`
      );
    }

    // Must use OrgProp or OrgLandlord organization for contract creation
    const allowedOrgs = ['OrgProp', 'OrgLandlord'];
    if (!allowedOrgs.includes(blockchainUser.orgName)) {
      throw new UnauthorizedException(
        `Contracts can only be created in ${allowedOrgs.join(' or ')} organizations, not ${blockchainUser.orgName}`
      );
    }
    
    // Verify user is the lessor in the contract
    if (contractDto.lessorId !== jwtUser.id.toString() && contractDto.lessorId !== jwtUser.sub) {
      throw new UnauthorizedException(
        `User ${jwtUser.id || jwtUser.sub} cannot create contract for lessor ${contractDto.lessorId}`
      );
    }
  }

  /**
   * Extract user roles from JWT user object (handle different formats)
   */
  private getUserRoles(user: any): string[] {
    if (!user) return [];
    
    // Handle roles array (new format)
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.map(role => role.toString().toUpperCase());
    }
    
    // Handle single role field (legacy format)
    if (user.role) {
      return [user.role.toString().toUpperCase()];
    }
    
    return [];
  }

  /**
   * Get contract by ID
   */
  @Get(':contractId')
  @ApiOperation({ 
    summary: 'Get contract by ID',
    description: 'Retrieves contract details from the blockchain by contract ID'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async getContract(
    @Param('contractId') contractId: string,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Getting contract: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.getContract(contractId, user);
    
    if (!result.success) {
      this.logger.error(`Failed to get contract: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Query contracts with filters
   */
  @Get()
  @ApiOperation({ 
    summary: 'Query contracts',
    description: 'Query contracts with various filters like status, party, date range'
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['CREATED', 'ACTIVE', 'TERMINATED'],
    description: 'Filter by contract status'
  })
  @ApiQuery({ 
    name: 'party', 
    required: false, 
    description: 'Filter by party ID (lessor or lessee)'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    description: 'Start date for date range query (ISO format)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    description: 'End date for date range query (ISO format)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contracts retrieved successfully'
  })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async queryContracts(
    @Query() queryParams: QueryContractsDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Querying contracts with params: ${JSON.stringify(queryParams)} for org: ${user.orgName}`);
    
    // Handle different query types
    if (queryParams.status) {
      return await this.blockchainService.queryContractsByStatus(queryParams.status, user);
    } else if (queryParams.party) {
      return await this.blockchainService.queryContractsByParty(queryParams.party, user);
    } else if (queryParams.startDate && queryParams.endDate) {
      return await this.blockchainService.queryContractsByDateRange(
        queryParams.startDate, 
        queryParams.endDate, 
        user
      );
    } else {
      // Default: query all active contracts
      return await this.blockchainService.queryContractsByStatus('ACTIVE', user);
    }
  }

  /**
   * Activate contract (requires both signatures)
   */
  @Put(':contractId/activate')
  @ApiOperation({ 
    summary: 'Activate contract',
    description: 'Activates a contract that has been signed by both lessor and lessee'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract activated successfully'
  })
  @ApiResponse({ status: 400, description: 'Contract cannot be activated (missing signatures)' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async activateContract(
    @Param('contractId') contractId: string,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Activating contract: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.activateContract(contractId, user);
    
    if (!result.success) {
      this.logger.error(`Failed to activate contract: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Terminate contract
   */
  @Put(':contractId/terminate')
  @ApiOperation({ 
    summary: 'Terminate contract',
    description: 'Terminates an active contract with specified reason'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract terminated successfully'
  })
  @ApiResponse({ status: 400, description: 'Contract cannot be terminated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async terminateContract(
    @Param('contractId') contractId: string,
    @Body() terminateDto: TerminateContractDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Terminating contract: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.terminateContract(contractId, terminateDto.reason, user);
    
    if (!result.success) {
      this.logger.error(`Failed to terminate contract: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Add signature to contract
   */
  @Post(':contractId/signatures')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Add signature to contract',
    description: 'Adds a digital signature from lessor or lessee to the contract'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Signature added successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid signature data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 409, description: 'Signature already exists' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async addSignature(
    @Param('contractId') contractId: string,
    @Body() addSignatureDto: AddSignatureDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Adding signature to contract: ${contractId} from party: ${addSignatureDto.party} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.addSignature(
      contractId,
      addSignatureDto.party,
      addSignatureDto.certSerial,
      addSignatureDto.sigMetaJson,
      user
    );
    
    if (!result.success) {
      this.logger.error(`Failed to add signature: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Get contract history
   */
  @Get(':contractId/history')
  @ApiOperation({ 
    summary: 'Get contract history',
    description: 'Retrieves the complete transaction history of a contract'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract history retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async getContractHistory(
    @Param('contractId') contractId: string,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Getting contract history: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.getContractHistory(contractId, user);
    
    if (!result.success) {
      this.logger.error(`Failed to get contract history: ${result.error}`);
    }
    
    return result;
  }
}
