import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  HttpStatus,
  UseGuards,
  NotFoundException,
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
import { ResponseCommon } from 'src/common/dto/response.dto';

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
  async findAll(): Promise<ResponseCommon<AccountResponseDto[]>> {
    const response = await this.accountService.findAll();
    const accounts = response.data ?? [];
    const data = accounts.map((acc) => ({
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    }));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy tài khoản theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseCommon<AccountResponseDto>> {
    const response = await this.accountService.findOne(id);
    const acc = response.data;
    if (!acc) {
      throw new NotFoundException('Account not found');
    }
    return new ResponseCommon(response.code, response.message, {
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tài khoản' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<ResponseCommon<AccountResponseDto>> {
    const response = await this.accountService.update(id, dto);
    const acc = response.data;
    if (!acc) {
      throw new NotFoundException('Account not found');
    }
    return new ResponseCommon(response.code, response.message, {
      id: acc.id,
      email: acc.email,
      isVerified: acc.isVerified,
      lastLoginAt: acc.lastLoginAt,
      fullName: acc.user?.fullName,
      phone: acc.user?.phone,
      roles: acc.roles,
    });
  }
}
