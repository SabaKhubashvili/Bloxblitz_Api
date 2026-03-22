import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IDailySpinBalancePort } from '../../../application/rewards/daily-spin/ports/daily-spin-balance.port';

/**
 * Credits the daily-spin prize directly to the user's live Redis balance.
 *
 * Uses the same Lua read-modify-write pattern as the rakeback adapter
 * so it is fully compatible with the BalanceSyncWorker dirty-set mechanism.
 */
@Injectable()
export class DailySpinBalanceAdapter implements IDailySpinBalancePort {
  private readonly logger = new Logger(DailySpinBalanceAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async creditBalance(username: string, amount: number): Promise<void> {
    const rounded = Math.round(amount * 100) / 100;

    const lua = `
      local balanceKey = KEYS[1]
      local credit     = tonumber(ARGV[1])
      local username   = ARGV[2]

      local function read_coin_balance(str)
        local ok, decoded = pcall(cjson.decode, str)
        if ok and type(decoded) == 'table' then
          return tonumber(decoded['b']) or 0
        end
        if ok and type(decoded) == 'number' then
          return decoded
        end
        return tonumber(str) or 0
      end

      local raw    = redis.call('GET', balanceKey)
      local newBal = credit

      if raw then
        local base = read_coin_balance(raw)
        newBal     = base + credit
        local ttl  = redis.call('TTL', balanceKey)
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
        keys:      [RedisKeys.user.balance.user(username)],
        arguments: [rounded.toString(), username],
      });
    } catch (err) {
      this.logger.error(
        `[DailySpinBalance] creditBalance failed — user=${username} amount=${rounded}`,
        err,
      );
      throw err;
    }
  }
}
