import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IIncrementUserBalancePort } from '../../../application/balance/ports/increment-user-balance.port';

/**
 * Redis-backed implementation of IIncrementUserBalancePort.
 *
 * Uses an atomic Lua read-modify-write script so balance updates are
 * race-free even under concurrent requests. Compatible with the
 * BalanceSyncWorker dirty-set mechanism — every mutation marks the user
 * as dirty so the worker can flush to the DB.
 *
 * The script handles both plain-number and JSON-encoded balance formats
 * for backwards compatibility with older Redis entries written by the
 * legacy session-balance adapter.
 */
@Injectable()
export class IncrementUserBalanceAdapter implements IIncrementUserBalancePort {
  private readonly logger = new Logger(IncrementUserBalanceAdapter.name);

  // Shared Lua: reads the balance (either JSON `{"b": N}` or a plain
  // number string), adds `credit`, writes back, marks dirty.
  private static readonly LUA = `
    local balanceKey = KEYS[1]
    local credit     = tonumber(ARGV[1])
    local username   = ARGV[2]

    local function parse_balance(raw)
      local ok, decoded = pcall(cjson.decode, raw)
      if ok and type(decoded) == 'table' then
        return tonumber(decoded['b']) or 0
      end
      if ok and type(decoded) == 'number' then
        return decoded
      end
      return tonumber(raw) or 0
    end

    local raw    = redis.call('GET', balanceKey)
    local newBal = credit

    if raw then
      local base = parse_balance(raw)
      newBal     = math.floor((base + credit) * 100 + 0.5) / 100
      local ttl  = redis.call('TTL', balanceKey)
      redis.call('SET', balanceKey, newBal)
      if ttl > 0 then
        redis.call('EXPIRE', balanceKey, ttl)
      end
    else
      newBal = math.floor(credit * 100 + 0.5) / 100
      redis.call('SET', balanceKey, newBal)
    end

    redis.call('SADD', 'user:balance:dirty', username)
    return tostring(newBal)
  `;

  constructor(private readonly redis: RedisService) {}

  async increment(username: string, amount: number): Promise<void> {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded <= 0) {
      this.logger.warn(
        `[IncrementBalance] Rejected non-positive amount=${amount} for user=${username}`,
      );
      return;
    }

    try {
      await this.redis.eval(IncrementUserBalanceAdapter.LUA, {
        keys: [RedisKeys.user.balance.user(username)],
        arguments: [rounded.toString(), username],
      });
    } catch (err) {
      this.logger.error(
        `[IncrementBalance] Redis eval failed — user=${username} amount=+${rounded}`,
        err,
      );
      throw err;
    }
  }
}
