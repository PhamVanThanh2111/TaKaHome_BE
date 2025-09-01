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
  ApiHeader
} from '@nestjs/swagger';

import { BlockchainService } from './blockchain.service';
import { BlockchainAuthGuard, BlockchainUser } from './guards/blockchain-auth.guard';
import { 
  CreatePaymentScheduleDto,
  RecordPaymentDto, 
  ApplyPenaltyDto, 
  QueryPaymentsDto,
  MarkOverdueDto
} from './dto/payment.dto';
import { FabricUser } from './interfaces/fabric.interface';

/**
 * Payments Controller
 * Handles all blockchain payment operations
 */
@Controller('api/blockchain/payments')
@ApiTags('Blockchain Payments')
@UseGuards(BlockchainAuthGuard)
@ApiHeader({
  name: 'orgName',
  description: 'Organization name (OrgProp, OrgTenant, OrgAgent)',
  required: true,
  example: 'OrgProp'
})
@ApiHeader({
  name: 'userId',
  description: 'User identity (optional, uses default if not provided)',
  required: false,
  example: 'admin-OrgProp'
})
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Create payment schedule for contract
   */
  @Post('contracts/:contractId/schedules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create payment schedule',
    description: 'Creates a payment schedule for a contract with multiple payment periods'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment schedule created successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid schedule data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async createPaymentSchedule(
    @Param('contractId') contractId: string,
    @Body() scheduleDto: CreatePaymentScheduleDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Creating payment schedule for contract: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.createPaymentSchedule(contractId, scheduleDto, user);
    
    if (!result.success) {
      this.logger.error(`Failed to create payment schedule: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Record a payment
   */
  @Post('contracts/:contractId/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Record payment',
    description: 'Records a payment made for a specific contract period'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment recorded successfully',
    schema: {
      example: {
        success: true,
        data: {
          objectType: "payment",
          paymentId: "PAY_CONTRACT_001_2025-01",
          contractId: "CONTRACT_001",
          period: "2025-01",
          amount: 15000000,
          status: "PAID",
          orderRef: "ORDER_001",
          paidAt: "2025-08-28T07:00:00.000Z"
        },
        message: "Operation recordPayment completed successfully"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 409, description: 'Payment already recorded' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async recordPayment(
    @Param('contractId') contractId: string,
    @Body() paymentDto: RecordPaymentDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Recording payment for contract: ${contractId}, period: ${paymentDto.period} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.recordPayment(
      contractId,
      paymentDto.period,
      paymentDto.amount,
      paymentDto.orderRef,
      user
    );
    
    if (!result.success) {
      this.logger.error(`Failed to record payment: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Mark payment as overdue
   */
  @Put('contracts/:contractId/payments/:period/overdue')
  @ApiOperation({ 
    summary: 'Mark payment as overdue',
    description: 'Marks a specific payment period as overdue'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiParam({ 
    name: 'period', 
    description: 'Payment period identifier',
    example: '2025-01'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment marked as overdue successfully'
  })
  @ApiResponse({ status: 400, description: 'Payment cannot be marked as overdue' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async markPaymentOverdue(
    @Param('contractId') contractId: string,
    @Param('period') period: string,
    @Body() overdueDto: MarkOverdueDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Marking payment as overdue for contract: ${contractId}, period: ${period} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.markPaymentOverdue(contractId, period, user);
    
    if (!result.success) {
      this.logger.error(`Failed to mark payment as overdue: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Apply penalty to contract
   */
  @Post('contracts/:contractId/penalties')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Apply penalty',
    description: 'Applies a penalty to a contract for various reasons (late payment, damage, etc.)'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Penalty applied successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid penalty data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async applyPenalty(
    @Param('contractId') contractId: string,
    @Body() penaltyDto: ApplyPenaltyDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Applying penalty to contract: ${contractId}, period: ${penaltyDto.period}, type: ${penaltyDto.penaltyType} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.applyPenalty(
      contractId,
      penaltyDto.period,
      penaltyDto.amount,
      penaltyDto.reason,
      user
    );
    
    if (!result.success) {
      this.logger.error(`Failed to apply penalty: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Query payments with filters
   */
  @Get()
  @ApiOperation({ 
    summary: 'Query payments',
    description: 'Query payments with various filters like status, contract ID, period'
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['SCHEDULED', 'PAID', 'OVERDUE'],
    description: 'Filter by payment status'
  })
  @ApiQuery({ 
    name: 'contractId', 
    required: false, 
    description: 'Filter by contract ID'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    description: 'Filter by period'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payments retrieved successfully'
  })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async queryPayments(
    @Query() queryParams: QueryPaymentsDto,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Querying payments with params: ${JSON.stringify(queryParams)} for org: ${user.orgName}`);
    
    if (queryParams.status) {
      return await this.blockchainService.queryPaymentsByStatus(queryParams.status, user);
    } else {
      // Default: query all payments
      return await this.blockchainService.queryPaymentsByStatus('PAID', user);
    }
  }

  /**
   * Get overdue payments
   */
  @Get('overdue')
  @ApiOperation({ 
    summary: 'Get overdue payments',
    description: 'Retrieves all overdue payments across all contracts'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Overdue payments retrieved successfully'
  })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async getOverduePayments(
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Getting overdue payments for org: ${user.orgName}`);
    
    const result = await this.blockchainService.queryOverduePayments(user);
    
    if (!result.success) {
      this.logger.error(`Failed to get overdue payments: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Get penalties for contract
   */
  @Get('contracts/:contractId/penalties')
  @ApiOperation({ 
    summary: 'Get contract penalties',
    description: 'Retrieves all penalties applied to a specific contract'
  })
  @ApiParam({ 
    name: 'contractId', 
    description: 'Unique contract identifier',
    example: 'CONTRACT_001'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contract penalties retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 500, description: 'Blockchain network error' })
  async getContractPenalties(
    @Param('contractId') contractId: string,
    @BlockchainUser() user: FabricUser
  ) {
    this.logger.log(`Getting penalties for contract: ${contractId} for org: ${user.orgName}`);
    
    const result = await this.blockchainService.getContractPenalties(contractId, user);
    
    if (!result.success) {
      this.logger.error(`Failed to get contract penalties: ${result.error}`);
    }
    
    return result;
  }
}
