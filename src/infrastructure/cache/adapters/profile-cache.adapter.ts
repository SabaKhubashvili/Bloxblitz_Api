import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service.js';
import { RedisKeys } from '../redis.keys.js';
import type { IProfileCachePort } from '../../../application/user/profile/ports/profile-cache.port.js';
import type { ProfileOutputDto } from '../../../application/user/profile/dto/profile.output-dto.js';

@Injectable()
export class ProfileCacheAdapter implements IProfileCachePort {
  private readonly logger = new Logger(ProfileCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async get(username: string): Promise<ProfileOutputDto | null> {
    const key = RedisKeys.cache.userProfile(username);

    try {
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;

      return JSON.parse(raw) as ProfileOutputDto;
    } catch (err) {
      this.logger.warn(`[ProfileCache] get() failed for ${username}`, err);
      return null;
    }
  }

  async set(
    username: string,
    data: ProfileOutputDto,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = RedisKeys.cache.userProfile(username);

    try {
      const payload = JSON.stringify(data);
      if (ttlSeconds) {
        await this.redis.mainClient.set(key, payload, { EX: ttlSeconds });
      } else {
        await this.redis.mainClient.set(key, payload);
      }
    } catch (err) {
      this.logger.warn(`[ProfileCache] set() failed for ${username}`, err);
    }
  }

  async invalidate(username: string): Promise<void> {
    const key = RedisKeys.cache.userProfile(username);

    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`[ProfileCache] invalidate() failed for ${username}`, err);
    }
  }
}
