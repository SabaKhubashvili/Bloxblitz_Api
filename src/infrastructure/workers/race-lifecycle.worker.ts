import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { IRaceRepository } from '../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../domain/race/ports/race-cache.port';
import { FinishRaceUseCase } from '../../application/race/use-cases/finish-race.use-case';
import { RACE_CACHE, RACE_REPOSITORY } from '../../application/race/tokens/race.tokens';

@Injectable()
export class RaceLifecycleWorker {
  private readonly logger = new Logger(RaceLifecycleWorker.name);

  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
    private readonly finishRace: FinishRaceUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const now = new Date();
    try {
      const promoted = await this.raceRepository.promoteDueScheduledRaces(now);
      if (promoted > 0) {
        await this.raceCache.deleteCurrentRace();
      }
    } catch (e) {
      this.logger.warn('[RaceLifecycle] promote failed', e);
    }

    try {
      const expired = await this.raceRepository.findExpiredLiveRaceIds(now);
      for (const id of expired) {
        try {
          await this.finishRace.execute(id);
        } catch (err) {
          this.logger.warn(`[RaceLifecycle] finish ${id} failed`, err);
        }
      }
    } catch (e) {
      this.logger.warn('[RaceLifecycle] expire scan failed', e);
    }
  }
}
