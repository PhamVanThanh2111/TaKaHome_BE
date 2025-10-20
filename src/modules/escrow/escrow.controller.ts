import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { EscrowAdjustDto } from './dto/escrow-adjust.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Lấy số dư tiền cọc hiện tại theo contract và người thuê',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  async getBalance(
    @Query('contractId') contractId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.escrowService.getBalanceByTenantAndContract(
      user.id,
      contractId,
    );
  }

  @Post(':id/deduct')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Khấu trừ tiền cọc (ví dụ: bồi thường hư hại)' })
  @ApiResponse({ status: 200, description: 'Khấu trừ thành công' })
  async deduct(@Param('id') accountId: string, @Body() dto: EscrowAdjustDto) {
    const result = await this.escrowService.deduct(
      accountId,
      dto.amount,
      dto.party ?? 'TENANT',
      dto.note,
    );
    const account = result.data;
    if (!account) {
      throw new Error('Không thể khấu trừ escrow');
    }
    return {
      accountId: account.id,
      balanceTenant: account.currentBalanceTenant,
      balanceLandlord: account.currentBalanceLandlord,
      updatedAt: account.updatedAt,
    };
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Hoàn trả tiền cọc cho (người thuê + chủ nhà)' })
  @ApiResponse({ status: 200, description: 'Hoàn cọc thành công' })
  async refund(@Param('id') accountId: string, @Body() dto: EscrowAdjustDto) {
    const result = await this.escrowService.refund(
      accountId,
      dto.amount,
      dto.party ?? 'TENANT',
      dto.note,
    );
    const account = result.data;
    if (!account) {
      throw new Error('Không thể hoàn escrow');
    }
    return {
      accountId: account.id,
      balanceTenant: account.currentBalanceTenant,
      balanceLandlord: account.currentBalanceLandlord,
      updatedAt: account.updatedAt,
    };
  }
}
