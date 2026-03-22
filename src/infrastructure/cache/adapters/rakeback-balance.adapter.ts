import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import { PrismaService } from '../../persistance/prisma/prisma.service';
import type { IRakebackBalancePort } from '../../../application/user/rakeback/ports/rakeback-balance.port';

/**
 * Same contract as {@link KinguinBalanceAdapter}: Redis live key first, then
 * PostgreSQL; seed Redis with SET NX before crediting when the key is absent so
 * we never replace a DB-only balance with just the credit amount.
 *
 * Lua matches Kinguin (plain `tonumber` first) with a small legacy fallback for
 * JSON-shaped values that older code may have written.
 */
@Injectable()
export class RakebackBalanceAdapter implements IRakebackBalancePort {
  private readonly logger = new Logger(RakebackBalanceAdapter.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getBalance(username: string): Promise<number> {
    const key = RedisKeys.user.balance.user(username);
    const raw = await this.redis.mainClient.get(key);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) {
          return Math.round(parsed * 100) / 100;
        }
      } catch {
        // fall through to DB
      }
    }

    this.logger.debug(
      `[RakebackBalance] Redis miss for ${username}, falling back to DB`,
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

  async creditBalance(username: string, amount: number): Promise<void> {
    const roundedAmount = Math.round(amount * 100) / 100;
    const key = RedisKeys.user.balance.user(username);

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
        `[RakebackBalance] Seeded Redis for ${username} from DB: ${dbBalance}`,
      );
    }

    const lua = `
      local balanceKey = KEYS[1]
      local credit     = tonumber(ARGV[1])
      local username   = ARGV[2]


      local raw = redis.call('GET', balanceKey)
      local newBal = credit

      if raw then
        newBal = tonumber(raw) + credit
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

    try {
      await this.redis.eval(lua, {
        keys: [key],
        arguments: [roundedAmount.toString(), username],
      });
    } catch (err) {
      this.logger.error(
        `[RakebackBalance] creditBalance failed — user=${username} amount=${roundedAmount}`,
        err,
      );
      throw err;
    }
  }
}
