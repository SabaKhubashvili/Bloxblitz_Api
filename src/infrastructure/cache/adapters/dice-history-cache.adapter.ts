import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IDiceHistoryCachePort } from '../../../application/game/dice/ports/dice-history-cache.port';
import type { DiceHistoryOutputDto } from '../../../application/game/dice/dto/dice-history.output-dto';
import type { DiceHistorySortOrder } from '../../../domain/game/dice/ports/dice-history.repository.port';

/**
 * Redis-backed {@link IDiceHistoryCachePort}.
 *
 * Version-based page keys match {@link MinesHistoryCacheAdapter}:
 *   cache:dice:history:{username}:version
 *   cache:dice:history:{username}:v{version}:p{page}:l{limit}:o{order}
 */
@Injectable()
export class DiceHistoryCacheAdapter implements IDiceHistoryCachePort {
  private readonly logger = new Logger(DiceHistoryCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  private async getVersion(username: string): Promise<number> {
    const raw = await this.redis.mainClient.get(
      RedisKeys.cache.diceHistoryVersion(username),
    );
    return raw ? parseInt(raw, 10) : 0;
  }

  async getPage(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
  ): Promise<DiceHistoryOutputDto | null> {
    try {
      const version = await this.getVersion(username);
      const key = RedisKeys.cache.diceHistoryPage(
        username,
        version,
        page,
        limit,
        order,
      );
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as DiceHistoryOutputDto;
    } catch (err) {
      this.logger.warn(
        `[DiceHistoryCache] getPage() failed — user=${username}`,
        err,
      );
      return null;
    }
  }

  async setPage(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
    data: DiceHistoryOutputDto,
    ttlSeconds = 120,
  ): Promise<void> {
    try {
      const version = await this.getVersion(username);
      const key = RedisKeys.cache.diceHistoryPage(
        username,
        version,
        page,
        limit,
        order,
      );
      await this.redis.mainClient.set(key, JSON.stringify(data), {
        EX: ttlSeconds,
      });
    } catch (err) {
      this.logger.warn(
        `[DiceHistoryCache] setPage() failed — user=${username}`,
        err,
      );
    }
  }

  async invalidate(username: string): Promise<void> {
    try {
      await this.redis.mainClient.incr(
        RedisKeys.cache.diceHistoryVersion(username),
      );
      this.logger.debug(
        `[DiceHistoryCache] Invalidated history cache — user=${username}`,
      );
    } catch (err) {
      this.logger.warn(
        `[DiceHistoryCache] invalidate() failed — user=${username}`,
        err,
      );
    }
  }
}
