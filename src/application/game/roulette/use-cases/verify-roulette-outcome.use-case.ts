import { BadRequestException, Injectable } from '@nestjs/common';
import {
  RouletteFairnessDomainService,
  type RouletteFairnessOutcome,
} from '../../../../domain/game/roulette/roulette-fairness.domain-service';

export interface VerifyRouletteOutcomeCommand {
  serverSeed: string;
  eosBlockId: string;
  /** Same as live game's `gameIndex` (bound into HMAC message). */
  gameIndex: number;
  expectedOutcome?: RouletteFairnessOutcome;
  expectedOutcomeHash?: string;
}

export interface VerifyRouletteOutcomeOutputDto {
  verified: boolean;
  outcome: RouletteFairnessOutcome;
  outcomeHash: string;
  outcomeMatchesExpected?: boolean;
  hashMatchesExpected?: boolean;
  message: string;
}

@Injectable()
export class VerifyRouletteOutcomeUseCase {
  constructor(private readonly fairness: RouletteFairnessDomainService) {}

  execute(cmd: VerifyRouletteOutcomeCommand): VerifyRouletteOutcomeOutputDto {
    const serverSeed = cmd.serverSeed?.trim();
    const eosBlockId = cmd.eosBlockId?.trim();

    if (!serverSeed || !eosBlockId) {
      throw new BadRequestException('serverSeed and eosBlockId are required');
    }
    if (!Number.isInteger(cmd.gameIndex) || cmd.gameIndex < 0) {
      throw new BadRequestException('gameIndex must be a non-negative integer');
    }

    const { outcome, outcomeHash } = this.fairness.deriveOutcome(
      serverSeed,
      eosBlockId,
      cmd.gameIndex,
    );

    if (
      cmd.expectedOutcomeHash != null &&
      cmd.expectedOutcomeHash.trim() !== '' &&
      cmd.expectedOutcomeHash.toLowerCase() !== outcomeHash.toLowerCase()
    ) {
      return {
        verified: false,
        outcome,
        outcomeHash,
        hashMatchesExpected: false,
        message: `Recomputed outcome hash does not match expected digest.`,
      };
    }

    if (cmd.expectedOutcome != null && cmd.expectedOutcome !== outcome) {
      return {
        verified: false,
        outcome,
        outcomeHash,
        outcomeMatchesExpected: false,
        hashMatchesExpected:
          cmd.expectedOutcomeHash != null
            ? cmd.expectedOutcomeHash.toLowerCase() ===
              outcomeHash.toLowerCase()
            : undefined,
        message: `Recomputed color ${outcome} does not match expected ${cmd.expectedOutcome}.`,
      };
    }

    return {
      verified: true,
      outcome,
      outcomeHash,
      outcomeMatchesExpected:
        cmd.expectedOutcome != null
          ? cmd.expectedOutcome === outcome
          : undefined,
      hashMatchesExpected:
        cmd.expectedOutcomeHash != null
          ? cmd.expectedOutcomeHash.toLowerCase() === outcomeHash.toLowerCase()
          : undefined,
      message: 'Roulette outcome verified.',
    };
  }
}
