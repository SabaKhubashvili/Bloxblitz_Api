import { Inject, Injectable } from '@nestjs/common';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import type { RaceLeaderboardEntry } from '../../../domain/race/ports/race.repository.port';
import { RACE_REPOSITORY, RACE_CACHE, RACE_CACHE_TTL } from '../tokens/race.tokens';

@Injectable()
export class GetLeaderboardUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  /**
   * Ordered by `wageredAmount` DESC, `updatedAt` ASC.
   * When `limit === 10`, results are cached under `race:{raceId}:top10`.
   */
  async execute(
    raceId: string,
    limit: number,
  ): Promise<RaceLeaderboardEntry[]> {
    if (limit === 10) {
      const cached = await this.raceCache.getTop10(raceId);
      if (cached !== null) {
        return cached;
      }
    }

    const rows = await this.raceRepository.findLeaderboardTop(raceId, limit);

    if (limit === 10 && rows.length >= 0) {
      await this.raceCache.setTop10(
        raceId,
        rows,
        RACE_CACHE_TTL.top10Sec,
      );
    }

    return rows;
  }
}
