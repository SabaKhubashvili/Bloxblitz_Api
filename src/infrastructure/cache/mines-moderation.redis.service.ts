import { Injectable, Logger } from '@nestjs/common';
import { RedisKeys } from './redis.keys';
import { RedisService } from './redis.service';

const ROLLING_WINDOW_MS = 3_600_000;
const ROLLING_KEY_TTL_SEC = 8_600;

export type MinesRedisControlStatus = 'BANNED' | 'LIMITED';

export type MinesModerationSnapshot = {
  status: MinesRedisControlStatus;
  maxBetAmount: number | null;
  maxGamesPerHour: number | null;
};

/**
 * Redis-only Mines moderation (written by admin-api). Never reads Prisma.
 */
@Injectable()
export class MinesModerationRedisService {
  private readonly log = new Logger(MinesModerationRedisService.name);

  constructor(private readonly redis: RedisService) {}

  async getSnapshot(username: string): Promise<MinesModerationSnapshot | null> {
    try {
      const key = RedisKeys.mines.playerControl(username);
      const all = await this.redis.hgetall(key);
      if (!all || Object.keys(all).length === 0) return null;
      const status = all.status;
      if (status !== 'BANNED' && status !== 'LIMITED') return null;

      let maxBetAmount: number | null = null;
      if (all.maxBetAmount !== undefined && all.maxBetAmount !== '') {
        const n = Number(all.maxBetAmount);
        if (Number.isFinite(n)) maxBetAmount = n;
      }

      let maxGamesPerHour: number | null = null;
      if (all.maxGamesPerHour !== undefined && all.maxGamesPerHour !== '') {
        const n = parseInt(all.maxGamesPerHour, 10);
        if (Number.isFinite(n)) maxGamesPerHour = n;
      }

      return {
        status: status as MinesRedisControlStatus,
        maxBetAmount,
        maxGamesPerHour,
      };
    } catch (e) {
      this.log.warn(
        `Mines moderation read failed — user=${username}: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  async countCompletionsInRollingHour(username: string): Promise<number> {
    try {
      const key = RedisKeys.mines.rollingHourCompletions(username);
      const cutoff = Date.now() - ROLLING_WINDOW_MS;
      await this.redis.zremrangebyscore(key, '-inf', cutoff);
      return this.redis.zcard(key);
    } catch (e) {
      this.log.warn(
        `Mines rolling-hour read failed — user=${username}: ${e instanceof Error ? e.message : e}`,
      );
      return 0;
    }
  }

  async recordCompletedGame(username: string, gameId: string): Promise<void> {
    try {
      const key = RedisKeys.mines.rollingHourCompletions(username);
      const now = Date.now();
      const cutoff = now - ROLLING_WINDOW_MS;
      await this.redis.zremrangebyscore(key, '-inf', cutoff);
      await this.redis.zadd(key, [{ score: now, value: gameId }]);
      await this.redis.expire(key, ROLLING_KEY_TTL_SEC);
    } catch (e) {
      this.log.warn(
        `Mines rolling-hour write failed — user=${username}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
