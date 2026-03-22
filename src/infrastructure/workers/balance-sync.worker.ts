import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../persistance/prisma/prisma.service';
import { RedisKeys } from '../cache/redis.keys';

const DIRTY_SET_KEY = 'user:balance:dirty';
const SYNC_INTERVAL_MS = 1000;

/**
 * Runs every 2 seconds and flushes Redis balances for all "dirty" users
 * (users whose balance changed since the last sync) to PostgreSQL.
 *
 * Flow:
 *  1. Atomically pop the entire dirty SET from Redis in one Lua call.
 *  2. For each username, read the live balance from Redis.
 *  3. Batch-update User.balance in PostgreSQL.
 *
 * The Lua script atomically retrieves and deletes the dirty set so that
 * balance changes arriving during the sync window are captured in the
 * next cycle, not silently dropped.
 */
@Injectable()
export class BalanceSyncWorker {
  private readonly logger = new Logger(BalanceSyncWorker.name);
  private isSyncing = false;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Interval(SYNC_INTERVAL_MS)
  async syncDirtyBalances(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const usernames = await this.popDirtyUsernames();
      if (usernames.length === 0) return;
      this.logger.debug(`Syncing balances for ${usernames.length} user(s)`);
      this.logger.debug(`Usernames: ${usernames.join(', ')}`);
      await this.flushBalancesToDb(usernames);
      this.logger.debug('Balances synced');
    } catch (err) {
      this.logger.error('Balance sync cycle failed', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Atomically fetches and clears the dirty-balance SET.
   * Any writes that happen after the DEL are queued for the next cycle.
   */
  private async popDirtyUsernames(): Promise<string[]> {
    const luaScript = `
      local members = redis.call('SMEMBERS', KEYS[1])
      if #members > 0 then
        redis.call('DEL', KEYS[1])
      end
      return members
    `;

    const result = await this.redis.eval(luaScript, {
      keys: [DIRTY_SET_KEY],
      arguments: [],
    });

    return Array.isArray(result) ? (result as string[]) : [];
  }

  /**
   * Reads each user's current Redis balance and writes it to PostgreSQL.
   * Unknown / null balances are skipped rather than zeroing the DB record.
   */
  private async flushBalancesToDb(usernames: string[]): Promise<void> {
    const balanceKeys = usernames.map((u) => RedisKeys.user.balance.user(u));
    const rawBalances = (await this.redis.mget(balanceKeys)) as string[];

    const updates: Array<{ username: string; balance: number }> = [];

    for (let i = 0; i < usernames.length; i++) {
      const raw = rawBalances[i];
      if (raw === null || raw === undefined) continue;
      this.logger.log(`Raw balance: ${JSON.stringify(raw)}`);
      let balance: number;
      try {
        const parsed = JSON.parse(raw as string) as unknown;
        if (typeof parsed === 'number') {
          balance = parsed;
        } else if (
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { b?: unknown }).b === 'number'
        ) {
          balance = (parsed as { b: number }).b;
        } else {
          balance = Number.NaN;
        }
      } catch {
        const n = parseFloat(raw as string);
        balance = isNaN(n) ? 0 : n;
      }
      if (typeof balance !== 'number' || isNaN(balance)) continue;

      // Safeguard: ensure balance has at most 2 decimal places
      const sanitized = Math.round(balance * 100) / 100;
      updates.push({ username: usernames[i], balance: sanitized });
    }

    if (updates.length === 0) return;

    await Promise.all(
      updates.map(({ username, balance }) =>
        this.prisma.user
          .update({
            where: { username },
            data: { balance },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to sync balance for ${username}`,
              err,
            ),
          ),
      ),
    );

    this.logger.debug(`Synced balances for ${updates.length} user(s)`);
  }
}
