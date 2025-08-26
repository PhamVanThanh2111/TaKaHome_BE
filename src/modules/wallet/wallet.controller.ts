import { Controller, Get, Post, Body } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletCreditDto } from './dto/wallet-credit.dto';
import { WalletDebitDto } from './dto/wallet-debit.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Lấy thông tin ví của chính user
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.walletService.getMyWallet(user.id);
  }

  // Nạp tiền / hoàn / điều chỉnh — tuỳ quyền, bạn có thể giới hạn cho ADMIN hoặc dùng cho topup đã xác nhận
  @Post('credit')
  async credit(@CurrentUser() user: JwtUser, @Body() dto: WalletCreditDto) {
    return this.walletService.credit(user.id, dto);
  }

  // Trừ tiền thanh toán hợp đồng
  @Post('debit')
  async debit(@CurrentUser() user: JwtUser, @Body() dto: WalletDebitDto) {
    return this.walletService.debit(user.id, dto);
  }
}
