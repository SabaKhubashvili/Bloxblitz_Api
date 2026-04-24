import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IProfileCachePort } from '../../../application/user/profile/ports/profile-cache.port';
import type {
  PrivateProfileOutputDto,
  ProfileOutputDto,
  PublicProfileOutputDto,
} from '../../../application/user/profile/dto/profile.output-dto';

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
      this.logger.warn(
        `[ProfileCache] invalidate() failed for ${username}`,
        err,
      );
    }
  }

  async getPublic(
    username: string,
  ): Promise<
    Omit<PublicProfileOutputDto, 'isOnline'> | PrivateProfileOutputDto | null
  > {
    const key = RedisKeys.cache.publicUserProfile(username);
    try {
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as PublicProfileOutputDto;
    } catch (err) {
      this.logger.warn(
        `[ProfileCache] getPublic() failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setPublic(
    username: string,
    data: PublicProfileOutputDto | PrivateProfileOutputDto,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = RedisKeys.cache.publicUserProfile(username);
    try {
      const payload = JSON.stringify(data);
      if (ttlSeconds) {
        await this.redis.mainClient.set(key, payload, { EX: ttlSeconds });
      } else {
        await this.redis.mainClient.set(key, payload);
      }
    } catch (err) {
      this.logger.warn(
        `[ProfileCache] setPublic() failed for ${username}`,
        err,
      );
    }
  }

  async invalidatePublic(username: string): Promise<void> {
    const key = RedisKeys.cache.publicUserProfile(username);
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `[ProfileCache] invalidatePublic() failed for ${username}`,
        err,
      );
    }
  }

  async getOnlineStatus(username: string): Promise<boolean | null> {
    const key = RedisKeys.user.online(username);
    try {
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as boolean;
    } catch (err) {
      this.logger.warn(
        `[ProfileCache] getOnlineStatus() failed for ${username}`,
        err,
      );
      return null;
    }
  }
}
