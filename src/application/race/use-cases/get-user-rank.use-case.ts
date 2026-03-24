import { Inject, Injectable } from '@nestjs/common';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import { RACE_REPOSITORY, RACE_CACHE, RACE_CACHE_TTL } from '../tokens/race.tokens';

@Injectable()
export class GetUserRankUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  /** `null` if the user has no entry in this race. */
  async execute(raceId: string, userId: string): Promise<number | null> {
    const cached = await this.raceCache.getUserRank(raceId, userId);
    if (cached !== null) {
      return cached;
    }

    const participant = await this.raceRepository.getParticipant(
      raceId,
      userId,
    );
    if (!participant) {
      return null;
    }

    const rank =
      participant.finalRank ??
      (await this.raceRepository.countParticipantsAhead(
        raceId,
        participant.wageredAmount,
        participant.updatedAt,
      )) + 1;

    await this.raceCache.setUserRank(
      raceId,
      userId,
      rank,
      RACE_CACHE_TTL.userRankSec,
    );
    return rank;
  }
}
