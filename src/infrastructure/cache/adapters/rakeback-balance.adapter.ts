import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service.js';
import { RedisKeys } from '../redis.keys.js';
import type { IRakebackBalancePort } from '../../../application/user/rakeback/ports/rakeback-balance.port.js';

/**
 * Balance is stored as JSON `{"b": <balance>, "p": <petValueBalance>}` in Redis.
 * All mutations must use cjson read-modify-write via Lua to stay atomic and
 * consistent with the Mines ledger and balance-sync worker.
 */
@Injectable()
export class RakebackBalanceAdapter implements IRakebackBalancePort {
  private readonly logger = new Logger(RakebackBalanceAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getBalance(username: string): Promise<number> {
    const raw = await this.redis.mainClient.get(
      RedisKeys.user.balance.user(username),
    );
    if (!raw) return 0;

    try {
      const parsed = JSON.parse(raw) as { b?: number };
      return typeof parsed.b === 'number' ? parsed.b : 0;
    } catch {
      return 0;
    }
  }

  async creditBalance(username: string, amount: number): Promise<void> {
    const roundedAmount = Math.round(amount * 100) / 100;

    const lua = `
      local balanceKey = KEYS[1]
      local credit     = tonumber(ARGV[1])
      local username   = ARGV[2]

      local raw = redis.call('GET', balanceKey)
      local newBal = credit

      if raw then
        local obj = cjson.decode(raw)
        newBal = (tonumber(obj['b']) or 0) + credit
        obj['b'] = newBal
        local ttl = redis.call('TTL', balanceKey)
        redis.call('SET', balanceKey, cjson.encode(obj))
        if ttl > 0 then
          redis.call('EXPIRE', balanceKey, ttl)
        end
      else
        redis.call('SET', balanceKey, cjson.encode({b = credit}))
      end

      redis.call('SADD', 'user:balance:dirty', username)
      return tostring(newBal)
    `;

    try {
      await this.redis.eval(lua, {
        keys: [RedisKeys.user.balance.user(username)],
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
