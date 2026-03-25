import { Injectable } from '@nestjs/common';
import { InvalidRaceWagerError } from '../../../domain/race/errors/race.errors';
import { IncrementRaceWagerUseCase } from './increment-race-wager.use-case';

@Injectable()
export class UpdateWagerOnActiveRaceUseCase {
  constructor(private readonly incrementRaceWager: IncrementRaceWagerUseCase) {}

  async execute(userUsername: string, amount: string): Promise<void> {
    const gross = parseFloat(amount.trim());
    if (!Number.isFinite(gross) || gross <= 0) {
      throw new InvalidRaceWagerError('Invalid decimal amount');
    }
    await this.incrementRaceWager.execute(
      {
        username: userUsername,
        grossBetAmount: gross,
        source: 'manual',
      },
      { ifNoActiveRace: 'throw', creditMode: 'explicit' },
    );
  }
}
