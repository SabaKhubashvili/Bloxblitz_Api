import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateRaceInput,
  IRaceRepository,
} from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import {
  InvalidRaceRewardsError,
  InvalidRaceTimeRangeError,
  RaceTimeOverlapError,
} from '../../../domain/race/errors/race.errors';
import { RACE_CACHE, RACE_REPOSITORY } from '../tokens/race.tokens';

@Injectable()
export class CreateRaceWithRewardsUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  async execute(input: CreateRaceInput): Promise<{ raceId: string }> {
    if (!input.rewards.length) {
      throw new InvalidRaceRewardsError('At least one reward tier is required');
    }
    const seen = new Set<number>();
    for (const r of input.rewards) {
      if (r.position < 1 || r.position > 10 || seen.has(r.position)) {
        throw new InvalidRaceRewardsError();
      }
      seen.add(r.position);
    }

    if (input.startTime >= input.endTime) {
      throw new InvalidRaceTimeRangeError();
    }

    const overlapping = await this.raceRepository.findRaceOverlappingTimeRange(
      input.startTime,
      input.endTime,
    );
    if (overlapping) {
      throw new RaceTimeOverlapError();
    }

    const raceId = await this.raceRepository.createRaceWithRewards(input);
    await this.raceCache.deleteCurrentRace();
    return { raceId };
  }
}
