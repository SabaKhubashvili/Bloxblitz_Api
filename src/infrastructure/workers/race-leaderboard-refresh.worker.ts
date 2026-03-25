import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { IRaceRepository } from '../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../domain/race/ports/race-cache.port';
import {
  RACE_CACHE,
  RACE_CACHE_TTL,
  RACE_REPOSITORY,
} from '../../application/race/tokens/race.tokens';

/**
 * Periodically overwrites cached top-10 from the database so merged snapshots
 * cannot drift far from Prisma, without deleting `race:current` on every bet.
 */
@Injectable()
export class RaceLeaderboardRefreshWorker {
  private readonly logger = new Logger(RaceLeaderboardRefreshWorker.name);

  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncActiveRaceLeaderboard(): Promise<void> {
    try {
      const race = await this.raceRepository.findActiveRace();
      if (!race) return;
      const top10 = await this.raceRepository.findLeaderboardTop(race.id, 10);
      await this.raceCache.setTop10(race.id, top10, RACE_CACHE_TTL.top10Sec);
    } catch (e) {
      this.logger.warn('[RaceLeaderboardRefresh] sync failed', e);
    }
  }
}
