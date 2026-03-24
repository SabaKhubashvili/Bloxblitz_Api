import { Inject, Injectable } from '@nestjs/common';
import { RaceNotFoundError } from '../../../domain/race/errors/race.errors';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import { RACE_REPOSITORY } from '../tokens/race.tokens';
import { UpdateUserWagerInRaceUseCase } from './update-user-wager-in-race.use-case';

@Injectable()
export class UpdateWagerOnActiveRaceUseCase {
  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    private readonly updateUserWagerInRace: UpdateUserWagerInRaceUseCase,
  ) {}

  async execute(userId: string, amount: string): Promise<void> {
    const race = await this.raceRepository.findActiveRace();
    if (!race) {
      throw new RaceNotFoundError('No active race');
    }
    await this.updateUserWagerInRace.execute({
      raceId: race.id,
      userId,
      amount,
    });
  }
}
