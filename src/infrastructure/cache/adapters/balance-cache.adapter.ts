import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IBalanceCachePort } from '../../../application/user/balance/ports/balance-cache.port';
import type {
  UserBalanceRecord,
  UserPetValueBalanceRecord,
} from '../../../domain/user/ports/balance.repository.port';

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

      const parsed = JSON.parse(raw) as number
      console.log(parsed);
      
      if (
        typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0
      ) {
        this.logger.warn(
          `[BalanceCache] Malformed cache entry for ${username}, evicting`,
        );
        void this.redis.del(key);
        return null;
      }

      return {
        balance: parsed,
      };
    } catch (err) {
      this.logger.warn(`[BalanceCache] get() failed for ${username}`, err);
      return null;
    }
  }
  async getPetValueBalance(
    username: string,
  ): Promise<UserPetValueBalanceRecord | null> {
    try {
      const key = RedisKeys.user.balance.petValue(username);
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as number;

      if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) {
        this.logger.warn(
          `[BalanceCache] Malformed pet value cache for ${username}, evicting`,
        );
        void this.redis.del(key);
        return null;
      }

      return {
        petValueBalance: parsed,
      };
    } catch (err) {
      this.logger.warn(
        `[BalanceCache] getPetValueBalance() failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async set(
    username: string,
    data: Partial<UserBalanceRecord> & Partial<UserPetValueBalanceRecord>,
    ttlSeconds?: number,
  ): Promise<void> {
    const { balance, petValueBalance } = data;
    const hasBalance =
      typeof balance === 'number' && Number.isFinite(balance) && balance >= 0;
    const hasPetValue =
      typeof petValueBalance === 'number' &&
      Number.isFinite(petValueBalance) &&
      petValueBalance >= 0;

    if (!hasBalance && !hasPetValue) return;

    const setOptions =
      ttlSeconds != null && ttlSeconds > 0 ? { EX: ttlSeconds } : undefined;
    const key = RedisKeys.user.balance.user(username);
    const petValueKey = RedisKeys.user.balance.petValue(username);

    try {
      const pipeline = this.redis.mainClient.multi();

      if (hasBalance) {
        pipeline.set(key, balance, setOptions);
      }
      if (hasPetValue) {
        pipeline.set(petValueKey, petValueBalance, setOptions);
      }

      await pipeline.exec();
    } catch (err) {
      this.logger.warn(`[BalanceCache] set() failed for ${username}`, err);
    }
  }

  async invalidate(username: string): Promise<void> {
    const key = RedisKeys.user.balance.user(username);

    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `[BalanceCache] invalidate() failed for ${username}`,
        err,
      );
    }
  }
}
