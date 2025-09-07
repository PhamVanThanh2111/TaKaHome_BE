import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Lấy số dư tiền cọc hiện tại theo tenant + property',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  async getBalance(
    @Query('tenantId') tenantId: string,
    @Query('propertyId') propertyId: string,
  ) {
    return this.escrowService.getBalanceByTenantAndProperty(
      tenantId,
      propertyId,
    );
  }
}
