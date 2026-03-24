import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import type { IRaceCachePort } from '../../../domain/race/ports/race-cache.port';
import { InvalidRaceWagerError } from '../../../domain/race/errors/race.errors';
import { RACE_REPOSITORY, RACE_CACHE } from '../tokens/race.tokens';

@Injectable()
export class UpdateUserWagerInRaceUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    @Inject(RACE_CACHE) private readonly raceCache: IRaceCachePort,
  ) {}

  /**
   * Increments `wageredAmount` and bumps `updatedAt` only when the increment
   * is positive (enforced here and in the repository).
   */
  async execute(params: {
    raceId: string;
    userId: string;
    amount: string;
  }): Promise<void> {
    let delta: Prisma.Decimal;
    try {
      delta = new Prisma.Decimal(params.amount.trim());
    } catch {
      throw new InvalidRaceWagerError('Invalid decimal amount');
    }
    if (delta.lte(0)) {
      throw new InvalidRaceWagerError();
    }

    await this.raceRepository.incrementWager(
      params.raceId,
      params.userId,
      params.amount.trim(),
    );
    await this.raceCache.invalidateAfterWager(params.raceId, params.userId);
  }
}
