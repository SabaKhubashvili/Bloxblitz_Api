import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RaceStatus } from '../../../domain/race/enums/race-status.enum';
import {
  RaceNotActiveError,
  RaceNotFoundError,
} from '../../../domain/race/errors/race.errors';
import type { IRaceRepository } from '../../../domain/race/ports/race.repository.port';
import { RACE_REPOSITORY } from '../tokens/race.tokens';
import {
  applyMultipliers,
  computeGrossRaceCredit,
} from '../policies/race-wager-credit.policy';
import { RaceWagerSignalsService } from '../services/race-wager-signals.service';
import { UpdateUserWagerInRaceUseCase } from './update-user-wager-in-race.use-case';

export type RaceWagerGameSource =
  | 'mines'
  | 'dice'
  | 'case'
  | 'crash'
  | 'roulette'
  | 'coinflip'
  | 'manual';

export type IncrementRaceWagerOptions = {
  /** When `'throw'`, missing active race surfaces `RaceNotFoundError`. */
  ifNoActiveRace?: 'noop' | 'throw';
  /** `explicit`: HTTP/manual credit. `from_stake`: game stake with anti-abuse curve. */
  creditMode?: 'from_stake' | 'explicit';
};

@Injectable()
export class IncrementRaceWagerUseCase {
  private readonly logger = new Logger(IncrementRaceWagerUseCase.name);

  constructor(
    @Inject(RACE_REPOSITORY) private readonly raceRepository: IRaceRepository,
    private readonly updateUserWagerInRace: UpdateUserWagerInRaceUseCase,
    private readonly signals: RaceWagerSignalsService,
  ) {}

  /**
   * Best-effort for game flows: never throws (logs DB / validation failures).
   */
  async executeBestEffort(params: {
    username: string;
    grossBetAmount: number;
    source: RaceWagerGameSource;
  }): Promise<void> {
    try {
      await this.execute(params, {
        ifNoActiveRace: 'noop',
        creditMode: 'from_stake',
      });
    } catch (e) {
      this.logger.warn(
        `[IncrementRaceWager] best-effort failed user=${params.username} source=${params.source}`,
        e,
      );
    }
  }

  async execute(
    params: {
      username: string;
      grossBetAmount: number;
      source: RaceWagerGameSource;
    },
    options?: IncrementRaceWagerOptions,
  ): Promise<void> {
    const race = await this.raceRepository.findActiveRace();
    if (!race) {
      if (options?.ifNoActiveRace === 'throw') {
        throw new RaceNotFoundError('No active race');
      }
      return;
    }

    if (Date.now() < race.startTime.getTime()) {
      if (options?.ifNoActiveRace === 'throw') {
        throw new RaceNotActiveError('Race has not started yet');
      }
      return;
    }

    if (race.status === RaceStatus.PAUSED || race.trackingPaused) {
      return;
    }

    const mode = options?.creditMode ?? 'from_stake';
    const rounded = Math.round(params.grossBetAmount * 100) / 100;
    const base =
      mode === 'explicit'
        ? rounded
        : computeGrossRaceCredit(params.grossBetAmount);
    if (base < 0.01) return;

    const velocityMult = await this.signals.takeVelocityMultiplier(
      params.username,
    );
    const minesMult =
      params.source === 'mines'
        ? await this.signals.minesQuickCashoutMultiplier(params.username)
        : 1;

    const factors =
      mode === 'explicit' ? [velocityMult] : [velocityMult, minesMult];
    const credited = applyMultipliers(base, ...factors);
    if (credited < 0.01) return;

    const delta = new Prisma.Decimal(credited).toFixed(2);
    if (new Prisma.Decimal(delta).lte(0)) return;

    await this.updateUserWagerInRace.execute({
      raceId: race.id,
      userUsername: params.username,
      amount: delta,
    });
  }

  /** Mines cashout after exactly one safe tile — feeds quick-cycle anti-abuse. */
  notifyMinesSingleTileCashout(username: string): void {
    void this.signals.bumpMinesOneTileCashout(username);
  }
}
