import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service.js';
import { RedisKeys } from '../redis.keys.js';
import type { IBalanceCachePort } from '../../../application/user/ports/balance-cache.port.js';
import type { UserBalanceRecord } from '../../../domain/user/ports/balance.repository.port.js';

/**
 * Stores and retrieves the balance API response snapshot using Redis.
 *
 * Key:  cache:user:balance:{username}   (see RedisKeys.cache.balance)
 * TTL:  configurable per call (the use case passes 30 s)
 *
 * The stored payload is a compact JSON string:
 *   {"b": <balance>, "p": <petValueBalance>}
 * Short field names keep the serialized size minimal — these keys may be
 * written and read thousands of times per minute under load.
 */
@Injectable()
export class BalanceCacheAdapter implements IBalanceCachePort {
  private readonly logger = new Logger(BalanceCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async get(username: string): Promise<UserBalanceRecord | null> {
    const key = RedisKeys.user.balance.user(username);

    try {
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { b: number; p: number };

      if (typeof parsed.b !== 'number' || typeof parsed.p !== 'number') {
        this.logger.warn(
          `[BalanceCache] Malformed cache entry for ${username}, evicting`,
        );
        void this.redis.del(key);
        return null;
      }

      return { balance: parsed.b, petValueBalance: parsed.p };
    } catch (err) {
      this.logger.warn(`[BalanceCache] get() failed for ${username}`, err);
      return null;
    }
  }

  async set(
    username: string,
    data: UserBalanceRecord,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = RedisKeys.user.balance.user(username);
    const payload = JSON.stringify({ b: data.balance, p: data.petValueBalance });

    try {
      await this.redis.mainClient.set(key, payload, { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`[BalanceCache] set() failed for ${username}`, err);
    }
  }

  async invalidate(username: string): Promise<void> {
    const key = RedisKeys.user.balance.user(username);

    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`[BalanceCache] invalidate() failed for ${username}`, err);
    }
  }
}
