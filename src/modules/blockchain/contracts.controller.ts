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
  HttpCode
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
  TenantSignContractDto,
  RecordDepositDto,
  RecordFirstPaymentDto,
  QueryContractsDto, 
  TerminateContractDto,
  StorePrivateDetailsDto
} from './dto/contract.dto';
import { FabricUser } from './interfaces/fabric.interface';

/**
 * Contracts Controller - Updated for Chaincode v2.0.0
 * Handles all blockchain contract operations with new workflow
 */
@Controller('api/blockchain/contracts')
@ApiTags('Blockchain Contracts')
@UseGuards(JwtBlockchainAuthGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'orgName',
  description: 'Organization name (OrgProp, OrgTenant, OrgLandlord)',
  required: true,
  example: 'OrgLandlord'
})
@ApiHeader({
  name: 'userId',
  description: 'User identity (optional, uses default if not provided)',
  required: false,
  example: 'admin-OrgLandlord'
})
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Create a new rental contract (landlord initiates)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create new rental contract (Landlord)',
    description: 'Creates a new rental contract on blockchain. Must be called by landlord. Status will be WAIT_TENANT_SIGNATURE.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Contract created successfully',
    example: {
      success: true,
      data: {
        objectType: "contract",
        contractId: "contract-001", 
        landlordId: "landlord001",
        tenantId: "tenant001",
        status: "WAIT_TENANT_SIGNATURE",
        rentAmount: 1500000000,
        depositAmount: 3000000000,
        currency: "VND"
      }
    }
  })
  async createContract(
    @Body() createContractDto: CreateBlockchainContractDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Creating contract ${createContractDto.contractId} for landlord ${createContractDto.landlordId}`);
    
    return this.blockchainService.createContract(createContractDto, blockchainUser);
  }

  /**
   * Tenant signs the contract
   */
  @Put(':contractId/tenant-sign')
  @ApiOperation({ 
    summary: 'Tenant signs contract',
    description: 'Tenant signs the contract. Must be called from OrgTenantMSP. Changes status to WAIT_DEPOSIT.'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract signed by tenant successfully' })
  async tenantSignContract(
    @Param('contractId') contractId: string,
    @Body() tenantSignDto: TenantSignContractDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Tenant signing contract ${contractId}`);
    
    return this.blockchainService.tenantSignContract(
      contractId,
      tenantSignDto.fullySignedContractFileHash,
      tenantSignDto.tenantSignatureMeta,
      blockchainUser
    );
  }

  /**
   * Record security deposits
   */
  @Put(':contractId/deposit')
  @ApiOperation({ 
    summary: 'Record deposit payment',
    description: 'Record deposit from landlord or tenant. Both deposits needed to progress to WAIT_FIRST_PAYMENT.'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Deposit recorded successfully' })
  async recordDeposit(
    @Param('contractId') contractId: string,
    @Body() depositDto: RecordDepositDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Recording ${depositDto.party} deposit for contract ${contractId}`);
    
    return this.blockchainService.recordDeposit(
      contractId,
      depositDto.party,
      depositDto.amount,
      depositDto.depositTxRef,
      blockchainUser
    );
  }

  /**
   * Record first month rent payment
   */
  @Put(':contractId/first-payment')
  @ApiOperation({ 
    summary: 'Record first payment',
    description: 'Record first month rent payment. Must be called from OrgTenantMSP. Changes status to ACTIVE.'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'First payment recorded successfully' })
  async recordFirstPayment(
    @Param('contractId') contractId: string,
    @Body() firstPaymentDto: RecordFirstPaymentDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Recording first payment for contract ${contractId}`);
    
    return this.blockchainService.recordFirstPayment(
      contractId,
      firstPaymentDto.amount,
      firstPaymentDto.paymentTxRef,
      blockchainUser
    );
  }

  /**
   * Generate monthly payment schedule
   */
  @Post(':contractId/schedule')
  @ApiOperation({ 
    summary: 'Create monthly payment schedule',
    description: 'Generate payment schedule based on first payment date with EOM-safe calculations.'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Payment schedule created successfully' })
  async createMonthlyPaymentSchedule(
    @Param('contractId') contractId: string,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Creating payment schedule for contract ${contractId}`);
    
    return this.blockchainService.createMonthlyPaymentSchedule(contractId, blockchainUser);
  }

  /**
   * Get contract by ID
   */
  @Get(':contractId')
  @ApiOperation({ 
    summary: 'Get contract details',
    description: 'Retrieve contract information by ID'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async getContract(
    @Param('contractId') contractId: string,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    return this.blockchainService.getContract(contractId, blockchainUser);
  }

  /**
   * Query contracts with filters
   */
  @Get()
  @ApiOperation({ 
    summary: 'Query contracts',
    description: 'Query contracts with various filters'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'partyId', required: false, description: 'Filter by party ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for range query' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for range query' })
  @ApiResponse({ status: 200, description: 'Contracts retrieved successfully' })
  async queryContracts(
    @Query() queryDto: QueryContractsDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    if (queryDto.status) {
      return this.blockchainService.queryContractsByStatus(queryDto.status, blockchainUser);
    }
    
    if (queryDto.party) {
      return this.blockchainService.queryContractsByParty(queryDto.party, blockchainUser);
    }
    
    if (queryDto.startDate && queryDto.endDate) {
      return this.blockchainService.queryContractsByDateRange(
        queryDto.startDate, 
        queryDto.endDate, 
        blockchainUser
      );
    }
    
    // Default: return contracts by current user's party
    const partyId = blockchainUser.userId || 'default';
    return this.blockchainService.queryContractsByParty(partyId, blockchainUser);
  }

  /**
   * Terminate contract
   */
  @Put(':contractId/terminate')
  @ApiOperation({ 
    summary: 'Terminate contract',
    description: 'Terminate an active contract with reason'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract terminated successfully' })
  async terminateContract(
    @Param('contractId') contractId: string,
    @Body() terminateDto: TerminateContractDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Terminating contract ${contractId} with reason: ${terminateDto.reason}`);
    
    return this.blockchainService.terminateContract(contractId, terminateDto.reason, blockchainUser);
  }

  /**
   * Get contract history
   */
  @Get(':contractId/history')
  @ApiOperation({ 
    summary: 'Get contract history',
    description: 'Retrieve complete transaction history for a contract'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract history retrieved successfully' })
  async getContractHistory(
    @Param('contractId') contractId: string,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    return this.blockchainService.getContractHistory(contractId, blockchainUser);
  }

  /**
   * Store private contract details
   */
  @Post(':contractId/private')
  @ApiOperation({ 
    summary: 'Store private contract details',
    description: 'Store sensitive contract information in private data collection'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Private details stored successfully' })
  async storePrivateDetails(
    @Param('contractId') contractId: string,
    @Body() privateDetailsDto: StorePrivateDetailsDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Storing private details for contract ${contractId}`);
    
    return this.blockchainService.storeContractPrivateDetails(
      contractId,
      privateDetailsDto.privateDataJson,
      blockchainUser
    );
  }

  /**
   * Get private contract details
   */
  @Get(':contractId/private')
  @ApiOperation({ 
    summary: 'Get private contract details',
    description: 'Retrieve private contract information from private data collection'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Private details retrieved successfully' })
  async getPrivateDetails(
    @Param('contractId') contractId: string,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    return this.blockchainService.getContractPrivateDetails(contractId, blockchainUser);
  }
}