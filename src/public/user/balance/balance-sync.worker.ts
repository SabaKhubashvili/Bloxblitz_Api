import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/provider/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class BalanceSyncWorker {
  private readonly logger = new Logger(BalanceSyncWorker.name);
  private isSyncing = false;
  private readonly BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ultra-fast sync every 3 seconds
   * Uses parallel processing and optimized Prisma raw queries
   */
  @Cron(CronExpression.EVERY_SECOND)
  async syncBalances() {
    // Skip if already syncing (prevent overlapping)
    if (this.isSyncing) {
      return;
    }
    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const synced = await this.executeSyncBatch();

      if (synced > 0) {
        const duration = Date.now() - startTime;
        this.logger.log(`✅ Synced ${synced} balances in ${duration}ms`);
      }
    } catch (error) {
      this.logger.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeSyncBatch(): Promise<number> {
    // 1️⃣ Get all dirty usernames (single Redis call)
    const dirtyUsernames = await this.redis.smembers('balance:dirty');

    if (dirtyUsernames.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${dirtyUsernames.length} dirty balances`);

    // 2️⃣ Fetch all balances in parallel (single mget call)
    const balanceKeys = dirtyUsernames.map((u) => `user:balance:${u}`);
    const balances = await this.redis.mget(balanceKeys);

    // 3️⃣ Build valid updates and collect invalid users
    const validUpdates: Array<{ username: string; balance: Decimal }> = [];
    const invalidUsers: string[] = [];

    for (let i = 0; i < dirtyUsernames.length; i++) {
      this.logger.log(`Found dirty user : ${dirtyUsernames[i]}`);
      const username = dirtyUsernames[i];
      const balanceStr = balances[i];

      if (balanceStr === null) {
        this.logger.warn(`No balance in Redis for ${username}`);
        invalidUsers.push(username);
        continue;
      }
      const normalized = this.normalizeMoney(balanceStr);

      if (!normalized) {
        this.logger.error(`Invalid balance for ${username}: ${balanceStr}`);
        invalidUsers.push(username);
        continue;
      }

      this.logger.log(`
        Preparing sync for ${username}: ${balanceStr} -> ${normalized}
        `);

      validUpdates.push({
        username,
        balance: normalized,
      });
    }

    // 4️⃣ Remove invalid users from dirty set immediately
    if (invalidUsers.length > 0) {
      await this.redis.srem('balance:dirty', ...invalidUsers);
    }

    if (validUpdates.length === 0) {
      return 0;
    }

    // 5️⃣ Process in batches with retry logic
    let totalSynced = 0;

    for (let i = 0; i < validUpdates.length; i += this.BATCH_SIZE) {
      const batch = validUpdates.slice(i, i + this.BATCH_SIZE);
      const success = await this.syncBatchWithRetry(batch);

      if (success) {
        totalSynced += batch.length;
        // Remove from dirty set only after successful sync
        await this.redis.srem('balance:dirty', ...batch.map((u) => u.username));
      }
    }

    return totalSynced;
  }

  /**
   * Sync batch with exponential backoff retry
   */
  private async syncBatchWithRetry(
    batch: Array<{ username: string; balance: Decimal }>,
    attempt = 1,
  ): Promise<boolean> {
    try {
      this.logger.log(`Syncing batch of ${batch.length}, attempt ${attempt}, data: ${JSON.stringify(batch)}`);
      await this.batchUpdatePostgres(batch);
      return true;
    } catch (error) {
      if (attempt >= this.MAX_RETRIES) {
        this.logger.error(
          `Failed to sync batch after ${this.MAX_RETRIES} attempts`,
          error,
        );
        return false;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt - 1);
      await this.sleep(delay);

      this.logger.warn(
        `Retry ${attempt}/${this.MAX_RETRIES} for batch of ${batch.length}`,
      );
      return this.syncBatchWithRetry(batch, attempt + 1);
    }
  }

  /**
   * ULTRA-OPTIMIZED: Single raw SQL query using CASE
   *
   */
  private async batchUpdatePostgres(
    updates: Array<{ username: string; balance: Decimal }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    // Build parameterized query to prevent SQL injection
    const usernames = updates.map((u) => u.username);
    const whenClauses = updates
      .map(
        (u, idx) =>
          `WHEN username = $${idx + 1} THEN $${idx + 1 + updates.length}::numeric(10,2)`,
      )
      .join(' ');

    const query = `
    UPDATE "User"
    SET 
      balance = CASE ${whenClauses} END,
      "updated_at" = NOW()
    WHERE username IN (${usernames.map((_, idx) => `$${idx + 1}`).join(',')})
  `;

    const params = [...usernames, ...updates.map((u) => u.balance)];

    await this.prisma.$executeRawUnsafe(query, ...params);
  }

  /**
   * Health check endpoint
   */
  async getStats(): Promise<{
    pendingSyncs: number;
    isSyncing: boolean;
  }> {
    const pendingSyncs = await this.redis.scard('balance:dirty');
    return {
      pendingSyncs,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Force immediate sync (useful for testing/debugging)
   */
  async forceSync(): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    try {
      return await this.executeSyncBatch();
    } finally {
      this.isSyncing = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  private normalizeMoney(value: string): Prisma.Decimal | null {
    try {
      const decimal = new Prisma.Decimal(value);
      return decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    } catch {
      return null;
    }
  }
}
