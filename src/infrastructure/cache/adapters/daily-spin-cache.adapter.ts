import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type {
  IDailySpinCachePort,
  DailySpinStatusCacheEntry,
} from '../../../application/rewards/daily-spin/ports/daily-spin-cache.port';
import { SPIN_STATUS_CACHE_TTL_S } from '../../../shared/config/spin-prizes.config';

@Injectable()
export class DailySpinCacheAdapter implements IDailySpinCachePort {
  private readonly logger = new Logger(DailySpinCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getStatus(username: string): Promise<DailySpinStatusCacheEntry | null> {
    try {
      return await this.redis.get<DailySpinStatusCacheEntry>(
        RedisKeys.dailySpin.status(username),
      );
    } catch (err) {
      this.logger.warn(`[DailySpinCache] getStatus failed for ${username}`, err);
      return null;
    }
  }

  async setStatus(
    username: string,
    entry: DailySpinStatusCacheEntry,
    ttlSeconds: number = SPIN_STATUS_CACHE_TTL_S,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.dailySpin.status(username),
        entry,
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`[DailySpinCache] setStatus failed for ${username}`, err);
    }
  }

  async invalidate(username: string): Promise<void> {
    try {
      await this.redis.del(RedisKeys.dailySpin.status(username));
    } catch (err) {
      this.logger.warn(`[DailySpinCache] invalidate failed for ${username}`, err);
    }
  }

  async acquireSpinLock(username: string, ttlMs: number): Promise<boolean> {
    try {
      return await this.redis.lock(RedisKeys.dailySpin.lock(username), ttlMs);
    } catch (err) {
      this.logger.warn(`[DailySpinCache] acquireSpinLock failed for ${username}`, err);
      return false;
    }
  }

  async releaseSpinLock(username: string): Promise<void> {
    try {
      await this.redis.unlock(RedisKeys.dailySpin.lock(username));
    } catch (err) {
      this.logger.warn(`[DailySpinCache] releaseSpinLock failed for ${username}`, err);
    }
  }
}
