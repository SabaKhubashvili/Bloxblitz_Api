import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IMinesHistoryCachePort } from '../../../application/game/mines/ports/mines-history-cache.port';
import type {
  MinesHistoryOutputDto,
  MinesHistoryItemOutputDto,
} from '../../../application/game/mines/dto/mines-history.output-dto';
import type { MinesHistorySortOrder } from '../../../domain/game/mines/ports/mines-history.repository.port';

/**
 * Redis-backed implementation of IMinesHistoryCachePort.
 *
 * Page cache strategy — version-based invalidation:
 *   Each user has a small counter key:
 *     cache:mines:history:{username}:version   (persistent, no TTL)
 *
 *   Page keys embed the current version:
 *     cache:mines:history:{username}:v{version}:p{page}:l{limit}:o{order}
 *
 *   invalidate() increments the version in O(1).  Old page keys become
 *   unreachable immediately and expire via their normal TTL as garbage
 *   collection — no SCAN/KEYS operation needed.
 *
 * Round cache:
 *   cache:mines:round:{gameId}   (no invalidation needed; rounds are immutable)
 */
@Injectable()
export class MinesHistoryCacheAdapter implements IMinesHistoryCachePort {
  private readonly logger = new Logger(MinesHistoryCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  // ── Version helper ─────────────────────────────────────────────────────────

  private async getVersion(username: string): Promise<number> {
    const raw = await this.redis.mainClient.get(
      RedisKeys.cache.minesHistoryVersion(username),
    );
    return raw ? parseInt(raw, 10) : 0;
  }

  // ── Page cache ─────────────────────────────────────────────────────────────

  async getPage(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
  ): Promise<MinesHistoryOutputDto | null> {
    try {
      const version = await this.getVersion(username);
      const key = RedisKeys.cache.minesHistoryPage(username, version, page, limit, order);
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as MinesHistoryOutputDto;
    } catch (err) {
      this.logger.warn(`[MinesHistoryCache] getPage() failed — user=${username}`, err);
      return null;
    }
  }

  async setPage(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
    data: MinesHistoryOutputDto,
    ttlSeconds = 120,
  ): Promise<void> {
    try {
      const version = await this.getVersion(username);
      const key = RedisKeys.cache.minesHistoryPage(username, version, page, limit, order);
      await this.redis.mainClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`[MinesHistoryCache] setPage() failed — user=${username}`, err);
    }
  }

  async invalidate(username: string): Promise<void> {
    try {
      await this.redis.mainClient.incr(
        RedisKeys.cache.minesHistoryVersion(username),
      );
      this.logger.debug(`[MinesHistoryCache] Invalidated history cache — user=${username}`);
    } catch (err) {
      this.logger.warn(`[MinesHistoryCache] invalidate() failed — user=${username}`, err);
    }
  }

  // ── Round cache ────────────────────────────────────────────────────────────

  async getRound(gameId: string): Promise<MinesHistoryItemOutputDto | null> {
    const key = RedisKeys.cache.minesRound(gameId);

    try {
      const raw = await this.redis.mainClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as MinesHistoryItemOutputDto;
    } catch (err) {
      this.logger.warn(`[MinesHistoryCache] getRound() failed — gameId=${gameId}`, err);
      return null;
    }
  }

  async setRound(
    gameId: string,
    data: MinesHistoryItemOutputDto,
    ttlSeconds = 300,
  ): Promise<void> {
    const key = RedisKeys.cache.minesRound(gameId);

    try {
      await this.redis.mainClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`[MinesHistoryCache] setRound() failed — gameId=${gameId}`, err);
    }
  }
}
