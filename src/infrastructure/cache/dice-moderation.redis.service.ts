import { Injectable, Logger } from '@nestjs/common';
import { RedisKeys } from './redis.keys';
import { RedisService } from './redis.service';

export type DiceRedisControlStatus = 'BANNED' | 'LIMITED';

export type DiceModerationSnapshot = {
  status: DiceRedisControlStatus;
  maxBetAmount: number | null;
};

/**
 * Redis-only Dice moderation (written by admin-api). Never reads Prisma.
 */
@Injectable()
export class DiceModerationRedisService {
  private readonly log = new Logger(DiceModerationRedisService.name);

  constructor(private readonly redis: RedisService) {}

  async getSnapshot(username: string): Promise<DiceModerationSnapshot | null> {
    try {
      const key = RedisKeys.dice.playerControl(username);
      const all = await this.redis.hgetall(key);
      if (!all || Object.keys(all).length === 0) return null;
      const status = all.status;
      if (status !== 'BANNED' && status !== 'LIMITED') return null;

      let maxBetAmount: number | null = null;
      if (all.maxBetAmount !== undefined && all.maxBetAmount !== '') {
        const n = Number(all.maxBetAmount);
        if (Number.isFinite(n)) maxBetAmount = n;
      }

      return {
        status: status as DiceRedisControlStatus,
        maxBetAmount,
      };
    } catch (e) {
      this.log.warn(
        `Dice moderation read failed — user=${username}: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }
}
