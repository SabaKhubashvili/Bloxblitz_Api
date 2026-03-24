import { Inject, Injectable } from '@nestjs/common';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import { RACE_REPOSITORY, RACE_CACHE } from '../tokens/race.tokens';

@Injectable()
export class FinishRaceUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  async execute(raceId: string): Promise<void> {
    await this.raceRepository.finishRace(raceId);
    await this.raceCache.invalidateAfterFinish(raceId);
  }
}
