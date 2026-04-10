import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

/** Aligned with `ws/.../roulette/constants/game.constants.ts` COLOR_WEIGHTS. */
export const ROULETTE_COLOR_WEIGHTS = {
  GREEN: 1,
  BROWN: 7,
  YELLOW: 7,
} as const;

export type RouletteFairnessOutcome = 'GREEN' | 'BROWN' | 'YELLOW';

/**
 * Roulette outcome derivation — must match {@link RouletteGameUtils} in `ws`.
 */
@Injectable()
export class RouletteFairnessDomainService {
  outcomeHash(serverSeed: string, eosBlockId: string, gameIndex: number): string {
    const msg = `${eosBlockId}-${gameIndex}`;
    return createHmac('sha256', serverSeed).update(msg).digest('hex');
  }

  deriveOutcome(
    serverSeed: string,
    eosBlockId: string,
    gameIndex: number,
  ): { outcome: RouletteFairnessOutcome; outcomeHash: string } {
    const outcomeHash = this.outcomeHash(serverSeed, eosBlockId, gameIndex);
    const uint32 = parseInt(outcomeHash.slice(0, 8), 16);
    const totalWeight =
      ROULETTE_COLOR_WEIGHTS.GREEN +
      ROULETTE_COLOR_WEIGHTS.BROWN +
      ROULETTE_COLOR_WEIGHTS.YELLOW;
    const slot = uint32 % totalWeight;

    let outcome: RouletteFairnessOutcome;
    if (slot < ROULETTE_COLOR_WEIGHTS.GREEN) {
      outcome = 'GREEN';
    } else if (
      slot <
      ROULETTE_COLOR_WEIGHTS.GREEN + ROULETTE_COLOR_WEIGHTS.BROWN
    ) {
      outcome = 'BROWN';
    } else {
      outcome = 'YELLOW';
    }

    return { outcome, outcomeHash };
  }
}
