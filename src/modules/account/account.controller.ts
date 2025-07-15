import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tài khoản' })
  @ApiResponse({ status: HttpStatus.OK, type: [AccountResponseDto] })
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
