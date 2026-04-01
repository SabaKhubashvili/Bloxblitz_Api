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
    const sorted = [...input.rewards].sort((a, b) => a.position - b.position);
    const seen = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i]!;
      if (r.position < 1 || r.position > 10 || seen.has(r.position)) {
        throw new InvalidRaceRewardsError();
      }
      seen.add(r.position);
      if (r.position !== i + 1) {
        throw new InvalidRaceRewardsError(
          'Positions must be sequential from 1 with no gaps',
        );
      }
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
