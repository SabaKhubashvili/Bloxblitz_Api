import { Injectable, Logger } from '@nestjs/common';
import { TowersGameStatus } from '@prisma/client';
import { TowersGameRepository } from '../../persistance/repositories/game/towers-game.repository';
import type { TowersGameEntity } from '../../persistance/repositories/game/towers-game.types';
import { TowersGameCacheMetricsService } from './towers-game-cache-metrics.service';
import { TowersGameRedisService } from './towers-game-redis.service';

/**
 * Redis-first active game resolution with DB repair on cache miss.
 */
@Injectable()
export class TowersActiveGameService {
  private readonly logger = new Logger(TowersActiveGameService.name);

  constructor(
    private readonly cache: TowersGameRedisService,
    private readonly repo: TowersGameRepository,
    private readonly metrics: TowersGameCacheMetricsService,
  ) {}

  /**
   * Cheap duplicate guard for **start game**: Redis EXISTS on the user pointer only.
   * Does not call the database unless Redis errors (degraded path).
   */
  async hasActiveGameQuick(username: string): Promise<boolean> {
    try {
      return await this.cache.hasUserActivePointer(username);
    } catch (err) {
      this.logger.warn(
        `[towers.cache] quick active check failed user=${username}`,
        err,
      );
      this.metrics.recordRedisError();
      const fromDb = await this.repo.findActiveByUser(username);
      return fromDb != null;
    }
  }

  async loadActive(username: string): Promise<TowersGameEntity | null> {
    const t0 = Date.now();
    try {
      const cached = await this.cache.getActiveForUser(username);
      if (cached) {
        if (cached.status !== TowersGameStatus.ACTIVE) {
          await this.cache.removeActiveGame(cached).catch(() => undefined);
          this.metrics.recordMiss();
        } else {
          this.metrics.recordHit(Date.now() - t0);
          return cached;
        }
      }
    } catch (err) {
      this.logger.warn(
        `[towers.cache] redis read failed user=${username}`,
        err,
      );
      this.metrics.recordRedisError();
    }

    this.metrics.recordMiss();
    const fromDb = await this.repo.findActiveByUser(username);
    if (fromDb) {
      try {
        await this.cache.putActiveGame(fromDb);
        this.metrics.recordRepair();
      } catch (err) {
        this.logger.warn(
          `[towers.cache] repair populate failed user=${username}`,
          err,
        );
      }
    }
    return fromDb;
  }
}
