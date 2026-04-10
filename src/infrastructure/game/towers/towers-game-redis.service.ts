import { Injectable, Logger } from '@nestjs/common';
import { TowersGameStatus } from '@prisma/client';
import { RedisKeys } from '../../cache/redis.keys';
import { RedisService } from '../../cache/redis.service';
import type { TowersGameEntity } from '../../persistance/repositories/game/towers-game.types';

function entityToJson(e: TowersGameEntity): Record<string, unknown> {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function jsonToEntity(o: Record<string, unknown>): TowersGameEntity {
  const base = o as unknown as TowersGameEntity;
  return {
    ...base,
    profilePicture:
      typeof o.profilePicture === 'string' ? o.profilePicture : '',
    createdAt: new Date(String(o.createdAt)),
    updatedAt: new Date(String(o.updatedAt)),
  };
}

@Injectable()
export class TowersGameRedisService {
  private readonly logger = new Logger(TowersGameRedisService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Store active game (no TTL). Also indexes user → gameId and global active set.
   */
  async putActiveGame(entity: TowersGameEntity): Promise<void> {
    if (entity.status !== TowersGameStatus.ACTIVE) {
      this.logger.warn(
        `Refusing to cache non-ACTIVE towers game in Redis gameId=${entity.gameHistoryId} status=${entity.status}`,
      );
      return;
    }
    const gid = entity.gameHistoryId;
    const user = entity.userUsername.toLowerCase();
    const payload = entityToJson(entity);
    await Promise.all([
      this.redis.set(RedisKeys.towers.game(gid), payload),
      this.redis.set(RedisKeys.towers.userActive(user), gid),
      this.redis.sadd(RedisKeys.towers.activeIndex(), gid),
    ]);
  }

  async getGameByHistoryId(gameHistoryId: string): Promise<TowersGameEntity | null> {
    const raw = await this.redis.get<Record<string, unknown>>(
      RedisKeys.towers.game(gameHistoryId),
    );
    if (!raw || typeof raw !== 'object') return null;
    try {
      return jsonToEntity(raw);
    } catch (e) {
      this.logger.warn(`Corrupt towers cache gameId=${gameHistoryId}`, e);
      return null;
    }
  }

  /**
   * O(1) check: whether the user has an active-game pointer (no JSON fetch, no DB).
   * Use before creating a game to avoid `loadActive` → DB fallback latency.
   */
  async hasUserActivePointer(username: string): Promise<boolean> {
    return this.redis.exists(RedisKeys.towers.userActive(username.toLowerCase()));
  }

  async getActiveForUser(username: string): Promise<TowersGameEntity | null> {
    const user = username.toLowerCase();
    const gid = await this.redis.get<string>(RedisKeys.towers.userActive(user));
    if (!gid || typeof gid !== 'string') return null;
    return this.getGameByHistoryId(gid);
  }

  /**
   * Remove game payload and user pointer. Call when a round ends (loss / cash-out / completed).
   */
  async removeActiveGame(entity: TowersGameEntity): Promise<void> {
    const gid = entity.gameHistoryId;
    const user = entity.userUsername.toLowerCase();
    await Promise.all([
      this.redis.del(RedisKeys.towers.game(gid)),
      this.redis.del(RedisKeys.towers.userActive(user)),
      this.redis.srem(RedisKeys.towers.activeIndex(), gid),
    ]);
  }

  /** Best-effort: delete keys even if partial state exists. */
  async removeByGameIdAndUser(gameHistoryId: string, username: string): Promise<void> {
    const user = username.toLowerCase();
    await Promise.all([
      this.redis.del(RedisKeys.towers.game(gameHistoryId)),
      this.redis.del(RedisKeys.towers.userActive(user)),
      this.redis.srem(RedisKeys.towers.activeIndex(), gameHistoryId),
    ]);
  }

  async activeGameCount(): Promise<number> {
    return this.redis.scard(RedisKeys.towers.activeIndex());
  }

  /**
   * Serialize reveal/cashout for a single game (short lock TTL; spin if contended).
   */
  async runExclusiveMutation<T>(gameHistoryId: string, fn: () => Promise<T>): Promise<T> {
    const key = RedisKeys.towers.lockMutation(gameHistoryId);
    const maxAttempts = 16;
    for (let a = 0; a < maxAttempts; a++) {
      const got = await this.redis.lock(key, 8000);
      if (got) {
        try {
          return await fn();
        } finally {
          await this.redis.unlock(key);
        }
      }
      await new Promise((r) => setTimeout(r, 3 * (a + 1)));
    }
    throw new Error('TOWERS_LOCK_BUSY');
  }
}
