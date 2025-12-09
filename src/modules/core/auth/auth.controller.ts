import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token-response.dto';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtLogoutGuard } from './guards/jwt-logout.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from './strategies/jwt.strategy';

@Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 requests/phút cho tất cả auth endpoints
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: RegisterResponseDto,
    description: 'Đăng ký thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ',
  })
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: LoginResponseDto,
    description: 'Đăng nhập thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sai thông tin đăng nhập',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiQuery({ name: 'code', description: 'Authorization code từ Google' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect sau khi xử lý Google OAuth',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không có authorization code',
  })
  async googleAuthCallback(@Query('code') code: string, @Query('error') error: string, @Res() res: Response) {
    if (error || !code) {
      return res.redirect(`${process.env.FRONTEND_URL}/signin?error=${error}`);
    }

    try {
      const result = await this.authService.handleGoogleLogin(code);

      // Encode toàn bộ object result thành base64 để truyền qua URL
      const encodedResult = Buffer.from(
        JSON.stringify(result),
        'utf-8', // Chỉ định encoding UTF-8 khi tạo Buffer
      ).toString('base64');

      return res.redirect(
        `${process.env.FRONTEND_URL}/login-success?data=${encodedResult}`,
      );
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      // Xử lý lỗi OAuth
      return res.redirect(
        `${process.env.FRONTEND_URL}/signin?error=oauth_failed`,
      );
    }
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } }) // 9 requests/5 phút
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset mật khẩu sau xác thực OTP Firebase' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ResetPasswordResponseDto,
    description: 'Reset mật khẩu thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy tài khoản với số điện thoại này',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.idToken, dto.newPassword);
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } }) // 9 requests/5 phút
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi email reset mật khẩu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Email đã được gửi (nếu tồn tại). Response luôn trả về success để bảo mật.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendForgotPasswordEmail(dto.email);
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } }) // 9 requests/5 phút
  @Post('reset-password-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset mật khẩu bằng token từ email' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ResetPasswordResponseDto,
    description: 'Reset mật khẩu thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  async resetPasswordWithToken(@Body() dto: ResetPasswordWithTokenDto) {
    return this.authService.resetPasswordWithToken(dto.token, dto.newPassword);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: RefreshTokenResponseDto,
    description: 'Làm mới token thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtLogoutGuard)
  @ApiOperation({ summary: 'Đăng xuất và xóa refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng xuất thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ',
  })
  async logout(@CurrentUser() user: JwtUser) {
    return this.authService.logout(user.id);
  }
}
