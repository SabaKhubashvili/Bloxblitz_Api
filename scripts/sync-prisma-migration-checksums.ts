/**
 * Reconciles `_prisma_migrations.checksum` with the current contents of each
 * `prisma/migrations/<name>/migration.sql` on disk (SHA-256 hex, same as Prisma).
 *
 * Use after intentionally editing already-applied migration SQL (e.g. idempotent
 * guards) so `prisma migrate dev` no longer asks for a full reset.
 *
 * Requires DATABASE_URL (same DB you use for migrate dev / deploy).
 *
 * Run: npm run migrate:sync-checksums
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- pg Pool + Prisma adapter setup */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

config();

const migrationsDir = path.join(__dirname, '../prisma/migrations');

function checksumForFile(filePath: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

/** pg needs explicit TLS for hosts that require SSL (e.g. DigitalOcean) even when the URL omits sslmode. */
function poolSsl(
  databaseUrl: string,
): undefined | { rejectUnauthorized: boolean } {
  const lower = databaseUrl.toLowerCase();
  if (lower.includes('sslmode=disable')) {
    return undefined;
  }
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('host.docker.internal')
  ) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: poolSsl(databaseUrl),
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    let updated = 0;
    let skipped = 0;

    for (const dir of dirs) {
      const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const checksum = checksumForFile(sqlPath);
      const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
        UPDATE "_prisma_migrations"
        SET checksum = ${checksum}
        WHERE migration_name = ${dir}
        RETURNING migration_name
      `;

      if (rows.length === 0) {
        skipped++;
      } else {
        updated++;
        console.log(`${dir}`);
        console.log(`  checksum -> ${checksum}`);
      }
    }

    console.log(
      `\nDone. Updated ${updated} row(s). ${skipped} folder(s) had no matching migration_name (ok).`,
    );
    console.log('Run: npx prisma migrate dev');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
