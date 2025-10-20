import { Controller, Get, Body, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ApiBearerAuth } from '@nestjs/swagger';
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
}
