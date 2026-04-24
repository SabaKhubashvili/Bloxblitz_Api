import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import { PrismaService } from '../../persistance/prisma/prisma.service';
import type { IKinguinBalancePort } from '../../../application/kinguin/ports/kinguin-balance.port';

/**
 * Kinguin balance operations use the same user balance as the main app.
 * Credits from Kinguin codes are added to the user's main balance.
 *
 * Read strategy: Redis (game-engine live key) → PostgreSQL fallback.
 * This mirrors PrismaBalanceRepository's two-tier read so that a cold cache
 * never causes us to treat an existing balance as zero.
 */
@Injectable()
export class KinguinBalanceAdapter implements IKinguinBalancePort {
  private readonly logger = new Logger(KinguinBalanceAdapter.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getBalance(username: string): Promise<number> {
    const key = RedisKeys.user.balance.user(username);
    const raw = await this.redis.mainClient.get(key);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as number;
        if (
          typeof parsed === 'number' &&
          Number.isFinite(parsed) &&
          parsed >= 0
        ) {
          return parsed;
        }
      } catch {
        // fall through to DB
      }
    }

    // Redis cache miss or malformed value — query the authoritative DB balance
    // to avoid treating a non-zero balance as zero during redemption.
    this.logger.debug(
      `[KinguinBalance] Redis miss for ${username}, falling back to DB`,
    );
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { balance: true },
    });
    if (!user) return 0;
    const balance = user.balance.toNumber();
    return Number.isFinite(balance) && balance >= 0
      ? Math.round(balance * 100) / 100
      : 0;
  }

  async creditBalance(username: string, amount: number): Promise<number> {
    const roundedAmount = Math.round(amount * 100) / 100;
    const key = RedisKeys.user.balance.user(username);

    // Guard against cache miss: if the Redis key is absent the Lua script would
    // SET the balance to only the credit amount, erasing any existing DB balance.
    // We seed Redis from PostgreSQL first using SET NX (set-if-not-exists) so
    // the atomic Lua increment always operates on the correct starting value.
    // SET NX prevents a race where a concurrent write populates the key between
    // our GET and this seed — in that case the NX set is a no-op and Lua reads
    // the already-correct value.
    const existing = await this.redis.mainClient.get(key);
    if (!existing) {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: { balance: true },
      });
      const dbBalance = user
        ? Math.round(user.balance.toNumber() * 100) / 100
        : 0;
      await this.redis.mainClient.set(key, dbBalance, { NX: true });
      this.logger.debug(
        `[KinguinBalance] Seeded Redis for ${username} from DB: ${dbBalance}`,
      );
    }

    let newBal = 0;
    const lua = `
      local balanceKey = KEYS[1]
      local credit     = tonumber(ARGV[1])
      local username   = ARGV[2]

      local raw = redis.call('GET', balanceKey)
      local newBal = credit

      if raw then
        newBal = (tonumber(raw) or 0) + credit
        local ttl = redis.call('TTL', balanceKey)
        redis.call('SET', balanceKey, newBal)
        if ttl > 0 then
          redis.call('EXPIRE', balanceKey, ttl)
        end
      else
        redis.call('SET', balanceKey, credit)
      end

      redis.call('SADD', 'user:balance:dirty', username)
      return tostring(newBal)
    `;
    const result = await this.redis.eval(lua, {
      keys: [key],
      arguments: [roundedAmount.toString(), username],
    });
    newBal = Number(result);
    return Math.round(newBal * 100) / 100;
  }
}
