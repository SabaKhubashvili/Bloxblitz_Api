/**
 * Server Seed Hash Migration Script
 *
 * Fixes historical records created with an incorrect serverSeedHash implementation.
 * Recalculates serverSeedHash = SHA256(serverSeed) for all relevant tables.
 *
 * Tables updated:
 * - SeedRotationHistory (Mines bet history verification)
 * - UserSeed (current/next seed state)
 * - OnlinePlayerFairness (Coinflip verification)
 *
 * Run: npm run migrate:server-seed-hash
 * Or:  npx ts-node scripts/fix-server-seed-hash-migration.ts
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { sha256HashServerSeed } from '../src/domain/shared/provably-fair-hash';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixSeedRotationHistory(): Promise<{ updated: number }> {
  const rows = await prisma.seedRotationHistory.findMany({
    select: { id: true, serverSeed: true, serverSeedHash: true },
  });

  let updated = 0;
  for (const row of rows) {
    const correctHash = sha256HashServerSeed(row.serverSeed);
    if (row.serverSeedHash !== correctHash) {
      await prisma.seedRotationHistory.update({
        where: { id: row.id },
        data: { serverSeedHash: correctHash },
      });
      updated++;
    }
  }
  return { updated };
}

async function fixUserSeed(): Promise<{ updated: number }> {
  const rows = await prisma.userSeed.findMany({
    select: {
      id: true,
      activeServerSeed: true,
      activeServerSeedHash: true,
      nextServerSeed: true,
      nextServerSeedHash: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const correctActiveHash = sha256HashServerSeed(row.activeServerSeed);
    const correctNextHash = sha256HashServerSeed(row.nextServerSeed);

    const needsUpdate =
      row.activeServerSeedHash !== correctActiveHash ||
      row.nextServerSeedHash !== correctNextHash;

    if (needsUpdate) {
      await prisma.userSeed.update({
        where: { id: row.id },
        data: {
          activeServerSeedHash: correctActiveHash,
          nextServerSeedHash: correctNextHash,
        },
      });
      updated++;
    }
  }
  return { updated };
}

async function fixOnlinePlayerFairness(): Promise<{ updated: number }> {
  const rows = await prisma.onlinePlayerFairness.findMany({
    select: { id: true, serverSeed: true, serverSeedHash: true },
  });

  let updated = 0;
  for (const row of rows) {
    const correctHash = sha256HashServerSeed(row.serverSeed);
    if (row.serverSeedHash !== correctHash) {
      await prisma.onlinePlayerFairness.update({
        where: { id: row.id },
        data: { serverSeedHash: correctHash },
      });
      updated++;
    }
  }
  return { updated };
}

async function main(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  SERVER SEED HASH MIGRATION                               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Fixing historical records with incorrect serverSeedHash...\n');

  const [srh, us, opf] = await Promise.all([
    fixSeedRotationHistory(),
    fixUserSeed(),
    fixOnlinePlayerFairness(),
  ]);

  console.log('Results:');
  console.log(`  SeedRotationHistory:   ${srh.updated} rows updated`);
  console.log(`  UserSeed:              ${us.updated} rows updated`);
  console.log(`  OnlinePlayerFairness:  ${opf.updated} rows updated`);
  console.log('\n✅ Migration complete.\n');
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
