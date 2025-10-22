import { Controller, Get, Body, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';

@Controller('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Lấy thông tin ví của chính user
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.walletService.getMyWallet(user.id);
  }

  // Lấy lịch sử giao dịch ví của user
  @Get('transactions')
  @ApiOperation({
    summary: 'Lấy lịch sử giao dịch ví của user',
    description: 'Trả về danh sách tất cả giao dịch trong ví của user hiện tại',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách giao dịch ví',
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
              walletId: { type: 'string' },
              direction: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
              type: { type: 'string', enum: ['TOPUP', 'CONTRACT_PAYMENT', 'REFUND', 'ADJUSTMENT'] },
              amount: { type: 'string' },
              status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED'] },
              refId: { type: 'string', nullable: true },
              note: { type: 'string', nullable: true },
              completedAt: { type: 'string', format: 'date-time', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  async getTransactionHistory(@CurrentUser() user: JwtUser) {
    return this.walletService.getTransactionHistory(user.id);
  }
}
