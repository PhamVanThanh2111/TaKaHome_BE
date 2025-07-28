import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';

@ApiTags('accounts')
@Controller('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tài khoản' })
  @ApiResponse({ status: HttpStatus.OK, type: [AccountResponseDto] })
  @Roles('ADMIN')
  async findAll(): Promise<AccountResponseDto[]> {
    const accounts = await this.accountService.findAll();
    return accounts.map((acc) => ({
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy tài khoản theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  async findOne(@Param('id') id: string): Promise<AccountResponseDto> {
    const acc = await this.accountService.findOne(id);
    if (!acc) {
      throw new Error('Account not found');
    }
    return {
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tài khoản' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const acc = await this.accountService.update(id, dto);
    if (!acc) {
      throw new Error('Account not found');
    }
    return {
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    };
  }
}
