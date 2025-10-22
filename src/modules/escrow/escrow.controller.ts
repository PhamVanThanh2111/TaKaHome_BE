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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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

  @Get('transactions')
  @ApiOperation({
    summary: 'Lấy danh sách giao dịch escrow của user',
    description: 'Trả về danh sách các giao dịch escrow mà user có quyền truy cập (là tenant hoặc landlord)',
  })
  @ApiQuery({
    name: 'contractId',
    required: false,
    description: 'ID của contract cụ thể (optional). Nếu không truyền sẽ trả về tất cả transactions của user',
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách giao dịch escrow',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'SUCCESS' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              direction: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
              type: { type: 'string', enum: ['DEPOSIT', 'DEDUCTION', 'REFUND'] },
              amount: { type: 'string' },
              status: { type: 'string' },
              note: { type: 'string' },
              completedAt: { type: 'string', format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              escrow: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  contractId: { type: 'string' },
                  currentBalanceTenant: { type: 'string' },
                  currentBalanceLandlord: { type: 'string' },
                  contract: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      contractCode: { type: 'string' },
                      tenant: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          fullName: { type: 'string' }
                        }
                      },
                      landlord: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          fullName: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  async getTransactionHistory(
    @CurrentUser() user: JwtUser,
    @Query('contractId') contractId?: string,
  ) {
    return this.escrowService.getTransactionHistory(user.id, contractId);
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
