import { Inject, Injectable } from '@nestjs/common';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import { RaceStatus } from '../../../domain/race/enums/race-status.enum';
import {
  buildRaceStatusCacheRecord,
  raceAndRewardsToStatusDto,
} from '../../../domain/race/race-status-snapshot';
import {
  RACE_CACHE,
  RACE_REPOSITORY,
  RACE_CACHE_TTL,
} from '../tokens/race.tokens';

export type RaceStatusDto = {
  isActive: boolean;
  totalPrizePool: number;
};

@Injectable()
export class GetRaceStatusUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  async execute(): Promise<RaceStatusDto> {
    const fromRedis = await this.raceCache.getRaceStatusSnapshot();
    if (fromRedis !== null) {
      return fromRedis;
    }

    const cached = await this.raceCache.getCurrentRace();
    if (cached) {
      const dto = raceAndRewardsToStatusDto(cached.race, cached.rewards);
      const record = buildRaceStatusCacheRecord(cached.race, cached.rewards);
      await this.raceCache.setRaceStatusRecord(
        record,
        RACE_CACHE_TTL.currentSec,
      );
      return dto;
    }

    const race = await this.raceRepository.findActiveRace();
    if (!race) {
      await this.raceCache.setRaceStatusRecord(
        {
          isActive: false,
          totalPrizePool: 0,
          startTime: new Date(0).toISOString(),
          endTime: new Date(1).toISOString(),
          status: RaceStatus.FINISHED,
        },
        RACE_CACHE_TTL.statusAbsentSec,
      );
      return { isActive: false, totalPrizePool: 0 };
    }

    const rewards = await this.raceRepository.findRewardsByRaceId(race.id);
    const payload = { race, rewards };
    await this.raceCache.setCurrentRace(payload, RACE_CACHE_TTL.currentSec);
    return raceAndRewardsToStatusDto(race, rewards);
  }
}
