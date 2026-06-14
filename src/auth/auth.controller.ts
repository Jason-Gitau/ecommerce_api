import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    this.logger.log('POST /auth/verify-email');
    try {
      const result = await this.authService.verifyEmail(dto.token);
      this.logger.log('verify-email succeeded');
      return result;
    } catch (err) {
      this.logger.error(`verify-email failed: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: RequestResetDto) {
    this.logger.log(`POST /auth/request-password-reset — email: ${dto.email}`);
    try {
      const result = await this.authService.requestPasswordReset(dto.email);
      this.logger.log(`request-password-reset completed for ${dto.email}`);
      return result;
    } catch (err) {
      this.logger.error(`request-password-reset failed for ${dto.email}: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    this.logger.log('POST /auth/reset-password');
    try {
      const result = await this.authService.resetPassword(dto.token, dto.newPassword);
      this.logger.log('reset-password succeeded');
      return result;
    } catch (err) {
      this.logger.error(`reset-password failed: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    this.logger.log(`POST /auth/register — email: ${dto.email}`);
    try {
      const result = await this.authService.register(dto);
      this.logger.log(`register succeeded for ${dto.email}`);
      return result;
    } catch (err) {
      this.logger.error(`register failed for ${dto.email}: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    this.logger.log(`POST /auth/login — email: ${dto.email}`);
    try {
      const { user, accessToken, refreshToken } = await this.authService.login(dto);
      this.setCookie(res, refreshToken);
      this.logger.log(`login succeeded for ${dto.email}`);
      return { accessToken, user };
    } catch (err) {
      this.logger.error(`login failed for ${dto.email}: ${err.message}`);
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('POST /auth/refresh');
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      this.logger.warn('refresh failed: no refresh_token cookie present');
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } = await this.authService.refreshTokens(refreshToken);
      this.setCookie(res, newRefreshToken);
      this.logger.log('refresh succeeded');
      return { accessToken };
    } catch (err) {
      this.logger.error(`refresh failed: ${err.message}`);
      throw err;
    }
  }

  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request & { user?: { id: string } }, @Res({ passthrough: true }) res: Response) {
    this.logger.log('POST /auth/logout');
    const refreshToken = req.cookies?.refresh_token;
    const userId = req.user?.id;
    if (!userId) {
      this.logger.warn('logout failed: no user on request');
      throw new UnauthorizedException('Unauthorized');
    }

    await this.authService.logout(userId, refreshToken);

    res.cookie('refresh_token', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
    this.logger.log(`logout succeeded for userId: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  private setCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }
}
