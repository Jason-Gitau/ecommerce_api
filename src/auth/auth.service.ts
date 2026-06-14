import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: Role.USER,
        isEmailVerified: false,
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    await this.emailService.sendVerificationEmail(user.email, token).catch((err) => {
      this.logger.error(`Failed to send verification email to ${user.email}: ${err?.message ?? err}`);
    });

    return {
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email first');
    }

    const { accessToken, refreshToken } = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async issueTokens(user: { id: string; email: string; role: string }) {
    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRY || '15m') as JwtSignOptions['expiresIn'];
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRY || '7d') as JwtSignOptions['expiresIn'];

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: process.env.JWT_SECRET ?? 'fallback-secret-dev-only', expiresIn: accessExpiresIn },
    );

    const jti = crypto.randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      { secret: process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret-dev-only', expiresIn: refreshExpiresIn },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, jti, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret-dev-only',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId: string = payload.sub;
    this.logger.log(`refreshTokens — userId: ${userId}, jti: ${payload.jti}`);

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.revoked || new Date() > stored.expiresAt) {
      this.logger.warn(`refreshTokens — token expired or revoked for userId: ${userId}`);
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!isValid) {
      this.logger.warn(`refreshTokens — token reuse detected for userId: ${userId}, revoking all tokens`);
      await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
      throw new UnauthorizedException('Security violation: token reuse detected');
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret-dev-only',
      });

      await this.prisma.refreshToken.updateMany({
        where: { userId, jti: payload.jti, revoked: false },
        data: { revoked: true },
      });
    } catch {
      // Token already expired or invalid; safe to ignore.
    }

    return { success: true };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return { success: true, message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string) {
    this.logger.log(`Password reset requested for: ${email}`);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`Password reset: no account found for ${email}`);
      return { success: true };
    }
    if (!user.isEmailVerified) {
      this.logger.warn(`Password reset: account ${email} is not email-verified`);
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    this.logger.log(`Sending password reset email to ${email}`);
    await this.emailService.sendPasswordResetEmail(user.email, token).catch((err) => {
      this.logger.error(`Failed to send password reset email to ${email}: ${err?.message ?? err}`);
    });

    this.logger.log(`Password reset flow completed for ${email}`);
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return { success: true, message: 'Password reset successfully' };
  }
}
