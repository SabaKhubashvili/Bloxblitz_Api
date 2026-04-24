import { Injectable, Logger } from '@nestjs/common';
import { RedisKeys } from './redis.keys';
import { RedisService } from './redis.service';

/**
 * Same Redis key as admin-api (`dice:betting:disabled`). One GET per roll.
 */
@Injectable()
export class DiceBettingDisabledRedisService {
  private readonly log = new Logger(DiceBettingDisabledRedisService.name);

  constructor(private readonly redis: RedisService) {}

  /** `true` when betting is globally disabled; missing key or Redis failure → enabled (false). */
  async isBettingDisabled(): Promise<boolean> {
    try {
      const raw = await this.redis.mainClient.get(
        RedisKeys.dice.bettingDisabled(),
      );
      return raw === '1';
    } catch (e) {
      this.log.warn(
        `Dice betting flag read failed: ${e instanceof Error ? e.message : e}`,
      );
      return false;
    }
  }
}
