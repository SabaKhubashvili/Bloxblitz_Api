import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type {
  IRakebackCachePort,
  RakebackSnapshot,
} from '../../../application/user/rakeback/ports/rakeback-cache.port';

const LOCK_PREFIX = 'lock:rakeback:claim:';

@Injectable()
export class RakebackCacheAdapter implements IRakebackCachePort {
  constructor(private readonly redis: RedisService) {}

  async get(username: string): Promise<RakebackSnapshot | null> {
    return this.redis.get<RakebackSnapshot>(
      RedisKeys.user.rakeback.user(username),
    );
  }

  async set(
    username: string,
    data: RakebackSnapshot,
    ttlSeconds = 30,
  ): Promise<void> {
    await this.redis.set(
      RedisKeys.user.rakeback.user(username),
      data,
      ttlSeconds,
    );
  }

  async invalidate(username: string): Promise<void> {
    await this.redis.del(RedisKeys.user.rakeback.user(username));
  }

  async acquireClaimLock(username: string, ttlMs: number): Promise<boolean> {
    return this.redis.lock(`${LOCK_PREFIX}${username}`, ttlMs);
  }

  async releaseClaimLock(username: string): Promise<void> {
    await this.redis.unlock(`${LOCK_PREFIX}${username}`);
  }
}
