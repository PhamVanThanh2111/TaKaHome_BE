import { 
  Controller, 
  Post, 
  Put, 
  Get,
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
  RecordPaymentDto,
  ApplyPenaltyDto,
  RecordPenaltyDto
} from './dto/contract.dto';
import { 
  RecordContractPenaltyDto,
  QueryPaymentsDto,
  MarkOverdueDto
} from './dto/payment.dto';
import { FabricUser } from './interfaces/fabric.interface';

/**
 * Payments Controller - Updated for Chaincode v2.0.0
 * Handles all blockchain payment operations
 */
@Controller('api/blockchain/payments')
@ApiTags('Blockchain Payments')
@UseGuards(JwtBlockchainAuthGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'orgName',
  description: 'Organization name (OrgTenant for payments)',
  required: true,
  example: 'OrgTenant'
})
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Record monthly rent payment
   */
  @Post(':contractId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Record monthly payment',
    description: 'Record monthly rent payment. Must be called from OrgTenantMSP.'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment recorded successfully',
    example: {
      success: true,
      data: {
        objectType: "payment",
        paymentId: "payment-contract001-2",
        contractId: "contract-001",
        period: 2,
        amount: 1500000000,
        status: "PAID"
      }
    }
  })
  async recordPayment(
    @Param('contractId') contractId: string,
    @Body() paymentDto: RecordPaymentDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Recording payment for contract ${contractId}, period ${paymentDto.period}`);
    
    return this.blockchainService.recordPayment(
      contractId,
      paymentDto.period,
      paymentDto.amount,
      blockchainUser,
      paymentDto.orderRef
    );
  }

  /**
   * Mark payment as overdue
   */
  @Put(':contractId/:period/overdue')
  @ApiOperation({ 
    summary: 'Mark payment overdue',
    description: 'Mark a scheduled payment as overdue based on due date'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiParam({ name: 'period', description: 'Payment period' })
  @ApiResponse({ status: 200, description: 'Payment marked as overdue' })
  async markOverdue(
    @Param('contractId') contractId: string,
    @Param('period') period: string,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Marking payment overdue for contract ${contractId}, period ${period}`);
    
    return this.blockchainService.markOverdue(contractId, period, blockchainUser);
  }

  /**
   * Apply penalty to payment
   */
  @Put(':contractId/:period/penalty')
  @ApiOperation({ 
    summary: 'Apply penalty to payment',
    description: 'Apply penalty to a specific payment period'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiParam({ name: 'period', description: 'Payment period' })
  @ApiResponse({ status: 200, description: 'Penalty applied successfully' })
  async applyPaymentPenalty(
    @Param('contractId') contractId: string,
    @Param('period') period: string,
    @Body() penaltyDto: ApplyPenaltyDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Applying penalty to contract ${contractId}, period ${period}`);
    
    return this.blockchainService.applyPenalty(
      contractId,
      period,
      penaltyDto.amount,
      penaltyDto.policyRef || '',
      penaltyDto.reason,
      blockchainUser
    );
  }

  /**
   * Record contract-level penalty
   */
  @Post(':contractId/penalties')
  @ApiOperation({ 
    summary: 'Record contract penalty',
    description: 'Record a contract-level penalty for landlord or tenant'
  })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 201, description: 'Contract penalty recorded successfully' })
  async recordContractPenalty(
    @Param('contractId') contractId: string,
    @Body() penaltyDto: RecordContractPenaltyDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log(`Recording contract penalty for ${penaltyDto.party} in contract ${contractId}`);
    
    return this.blockchainService.recordPenalty(
      contractId,
      penaltyDto.party,
      penaltyDto.amount,
      penaltyDto.reason,
      blockchainUser
    );
  }

  /**
   * Query payments by status
   */
  @Get()
  @ApiOperation({ 
    summary: 'Query payments',
    description: 'Query payments with status filter'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Payment status filter' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async queryPayments(
    @Query() queryDto: QueryPaymentsDto,
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    if (queryDto.status) {
      return this.blockchainService.queryPaymentsByStatus(queryDto.status, blockchainUser);
    }
    
    // Default: query scheduled payments
    return this.blockchainService.queryPaymentsByStatus('SCHEDULED', blockchainUser);
  }

  /**
   * Query overdue payments
   */
  @Get('overdue')
  @ApiOperation({ 
    summary: 'Query overdue payments',
    description: 'Get all overdue payments across contracts'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Overdue payments retrieved successfully',
    example: {
      success: true,
      data: [{
        objectType: "payment",
        contractId: "contract-001",
        period: 3,
        status: "OVERDUE",
        daysPastDue: 5,
        penaltyAmount: 50000000
      }]
    }
  })
  async queryOverduePayments(
    @BlockchainUser() blockchainUser: FabricUser
  ) {
    this.logger.log('Querying overdue payments');
    
    return this.blockchainService.queryOverduePayments(blockchainUser);
  }
}