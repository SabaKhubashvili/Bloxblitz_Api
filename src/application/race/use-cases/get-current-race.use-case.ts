import { Inject, Injectable } from '@nestjs/common';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import type { RaceRecord } from '../../../domain/race/ports/race.repository.port';
import type { RaceLeaderboardEntry } from '../../../domain/race/ports/race.repository.port';
import { RACE_REPOSITORY, RACE_CACHE, RACE_CACHE_TTL } from '../tokens/race.tokens';

export interface CurrentRaceView {
  race: RaceRecord | null;
  rewardDistribution: Array<{ position: number; rewardAmount: string }>;
  top10: RaceLeaderboardEntry[];
  userRank: number | null;
}

@Injectable()
export class GetCurrentRaceUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  async execute(userId?: string | null): Promise<CurrentRaceView> {
    let cached = await this.raceCache.getCurrentRace();

    if (!cached) {
      const race = await this.raceRepository.findActiveRace();
      if (!race) {
        return {
          race: null,
          rewardDistribution: [],
          top10: [],
          userRank: null,
        };
      }
      const rewards = await this.raceRepository.findRewardsByRaceId(race.id);
      const rewardDistribution = rewards.map((r) => ({
        position: r.position,
        rewardAmount: r.rewardAmount,
      }));
      cached = { race, rewards: rewardDistribution };
      await this.raceCache.setCurrentRace(cached, RACE_CACHE_TTL.currentSec);
    }

    const raceId = cached.race.id;

    let top10 = await this.raceCache.getTop10(raceId);
    if (top10 === null) {
      top10 = await this.raceRepository.findLeaderboardTop(raceId, 10);
      await this.raceCache.setTop10(
        raceId,
        top10,
        RACE_CACHE_TTL.top10Sec,
      );
    }

    let userRank: number | null = null;
    if (userId) {
      const cachedRank = await this.raceCache.getUserRank(raceId, userId);
      if (cachedRank !== null) {
        userRank = cachedRank;
      } else {
        const participant = await this.raceRepository.getParticipant(
          raceId,
          userId,
        );
        if (participant) {
          userRank =
            participant.finalRank ??
            (await this.raceRepository.countParticipantsAhead(
              raceId,
              participant.wageredAmount,
              participant.updatedAt,
            )) + 1;
          await this.raceCache.setUserRank(
            raceId,
            userId,
            userRank,
            RACE_CACHE_TTL.userRankSec,
          );
        }
      }
    }

    return {
      race: cached.race,
      rewardDistribution: cached.rewards,
      top10,
      userRank,
    };
  }
}
