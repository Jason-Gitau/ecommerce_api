import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public() // 👈 Always public
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', uptime: process.uptime() };
    } catch (error) {
      return { status: 'error', database: 'disconnected', error: 'DB connection failed' };
    }
  }
}