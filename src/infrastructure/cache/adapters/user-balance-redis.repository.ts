import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type {
  DecrementBalanceResult,
  IUserBalanceRepository,
} from '../../../application/balance/ports/user-balance.repository.port';
import { PrismaService } from '../../../infrastructure/persistance/prisma/prisma.service';

/**
 * Redis implementation of {@link IUserBalanceRepository}.
 *
 * Increment and decrement each use an atomic Lua script with the same
 * `parse_balance` rules (plain number or legacy JSON `{"b":N}`), TTL
 * preservation on update, and `SADD` to `user:balance:dirty` for the sync worker.
 */
@Injectable()
export class UserBalanceRedisRepository implements IUserBalanceRepository {
  private readonly logger = new Logger(UserBalanceRedisRepository.name);

  private static readonly LUA_INCREMENT = `
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

  private static readonly LUA_DECREMENT = `
    local balanceKey = KEYS[1]
    local debit      = tonumber(ARGV[1])
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

    if not debit or debit <= 0 then
      return 'INVALID'
    end

    local raw = redis.call('GET', balanceKey)
    if not raw then
      return 'INSUFFICIENT'
    end

    local base   = parse_balance(raw)
    local newBal = math.floor((base - debit) * 100 + 0.5) / 100

    if newBal < -0.000001 then
      return 'INSUFFICIENT'
    end

    local ttl = redis.call('TTL', balanceKey)
    redis.call('SET', balanceKey, newBal)
    if ttl > 0 then
      redis.call('EXPIRE', balanceKey, ttl)
    end

    redis.call('SADD', 'user:balance:dirty', username)
    return 'OK'
  `;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async increment(username: string, amount: number): Promise<void> {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded <= 0) {
      this.logger.warn(
        `[UserBalance] increment rejected non-positive amount=${amount} user=${username}`,
      );
      return;
    }

    try {
      await this.redis.eval(UserBalanceRedisRepository.LUA_INCREMENT, {
        keys: [RedisKeys.user.balance.user(username)],
        arguments: [rounded.toString(), username],
      });
    } catch (err) {
      this.logger.error(
        `[UserBalance] increment Redis eval failed user=${username} amount=+${rounded}`,
        err,
      );
      throw err;
    }
  }

  async tryDecrement(
    username: string,
    amount: number,
  ): Promise<DecrementBalanceResult> {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded <= 0) {
      return { ok: false, reason: 'invalid_amount' };
    }

    try {
      const out = await this.redis.eval(
        UserBalanceRedisRepository.LUA_DECREMENT,
        {
          keys: [RedisKeys.user.balance.user(username)],
          arguments: [rounded.toString(), username],
        },
      );

      const tag = String(out ?? '');
      if (tag === 'OK') {
        return { ok: true };
      }
      if (tag === 'INSUFFICIENT') {
        return { ok: false, reason: 'insufficient_funds' };
      }
      return { ok: false, reason: 'invalid_amount' };
    } catch (err) {
      this.logger.error(
        `[UserBalance] decrement Redis eval failed user=${username} amount=-${rounded}`,
        err,
      );
      throw err;
    }
  }
  async runDatabaseTransaction(
    username: string,
    amount: number,
  ): Promise<DecrementBalanceResult> {
    const result = await this.prisma.user.update({
      where: { username },
      data: { balance: { decrement: amount } },
    });

    if (result.balance.toNumber() < 0) {
      return { ok: false, reason: 'insufficient_funds' };
    }
    await this.redis.set(
      RedisKeys.user.balance.user(username),
      result.balance.toString(),
    );
    return { ok: true };
  }
}
