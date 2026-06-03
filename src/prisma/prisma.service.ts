import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 👇 Create PostgreSQL adapter for runtime (pooler-compatible)
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);

    // 👇 Pass adapter to PrismaClient constructor (Prisma 7+ requirement)
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}