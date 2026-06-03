import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: Role.USER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return { user, access_token: token };
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

    // 1. Access Token (short-lived)
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: process.env.JWT_SECRET ?? 'fallback-secret-dev-only', expiresIn: accessExpiresIn },
    );

    // 2. Refresh Token (long-lived + tracked)
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
  async refreshTokens(userId: string, refreshToken: string) {
    // Verify JWT signature & expiry
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sub !== userId) throw new UnauthorizedException('User mismatch');

    // Find in DB
    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.revoked || new Date() > stored.expiresAt) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    // Verify hash
    const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!isValid) {
      // 🔒 SECURITY: Concurrent refresh attack detected → revoke ALL tokens for user
      await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
      throw new UnauthorizedException('Security violation: token reuse detected');
    }
  // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      await this.prisma.refreshToken.updateMany({ 
        where: { userId, jti: payload.jti, revoked: false }, 
        data: { revoked: true } 
      });
    } catch {
      // Token already expired/invalid → safe to ignore
    }
    return { success: true };
  }
}
