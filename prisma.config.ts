import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export default defineConfig({
  migrate: {
    async adapter(env) {
      const pool = new Pool({
        connectionString: env['DIRECT_URL'] ?? env['DATABASE_URL'],
      });
      return new PrismaPg(pool);
    },
  },
});
