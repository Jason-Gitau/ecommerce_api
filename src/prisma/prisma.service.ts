import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Keep the connection pool small for memory-constrained hosts.
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 2),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    const adapter = new PrismaPg(pool);

    // Pass adapter to PrismaClient constructor (Prisma 7+ requirement).
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
