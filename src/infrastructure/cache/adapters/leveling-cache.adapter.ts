import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service.js';
import { RedisKeys } from '../redis.keys.js';
import type { ILevelingCachePort } from '../../../application/user/leveling/ports/leveling-cache.port.js';
import {
  LevelProgressMapper,
  type CachedLevelData,
} from '../../../application/user/leveling/mappers/level-progress.mapper.js';
import type { LevelProgress } from '../../../domain/leveling/entities/level-progress.entity.js';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class LevelingCacheAdapter implements ILevelingCachePort {
  private readonly logger = new Logger(LevelingCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getUserLevel(username: string): Promise<LevelProgress | null> {
    try {
      const data = await this.redis.get<CachedLevelData>(
        RedisKeys.leveling.userInfo(username),
      );
      if (!data) return null;
      return LevelProgressMapper.fromCachePayload(data);
    } catch (err) {
      this.logger.warn(`[LevelingCache] Redis read failed for ${username}`, err);
      return null;
    }
  }

  async setUserLevel(
    username: string,
    levelProgress: LevelProgress,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.leveling.userInfo(username),
        LevelProgressMapper.toCachePayload(levelProgress),
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`[LevelingCache] Redis write failed for ${username}`, err);
    }
  }

  async invalidateUserLevel(username: string): Promise<void> {
    try {
      await this.redis.del(RedisKeys.leveling.userInfo(username));
    } catch (err) {
      this.logger.warn(`[LevelingCache] Redis delete failed for ${username}`, err);
    }
  }
}
