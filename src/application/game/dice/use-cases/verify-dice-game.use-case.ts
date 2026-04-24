import { BadRequestException, Injectable } from '@nestjs/common';
import { DiceFairnessDomainService } from '../../../../domain/game/dice/services/dice-fairness.domain-service';

export interface VerifyDiceGameCommand {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  /** If set, must equal the recomputed roll (two decimal places). */
  expectedRollResult?: number;
}

export interface VerifyDiceGameOutputDto {
  verified: boolean;
  rollResult: number;
  won: boolean;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  rollMatchesExpected?: boolean;
  message: string;
}

@Injectable()
export class VerifyDiceGameUseCase {
  constructor(private readonly fairness: DiceFairnessDomainService) {}

  execute(cmd: VerifyDiceGameCommand): VerifyDiceGameOutputDto {
    if (!cmd.serverSeed?.trim() || !cmd.clientSeed?.trim()) {
      throw new BadRequestException('serverSeed and clientSeed are required');
    }
    if (!Number.isInteger(cmd.nonce) || cmd.nonce < 0) {
      throw new BadRequestException('nonce must be a non-negative integer');
    }
    if (!Number.isFinite(cmd.chance) || cmd.chance <= 0 || cmd.chance > 99.99) {
      throw new BadRequestException('chance must be between 0.01 and 99.99');
    }
    if (cmd.rollMode !== 'OVER' && cmd.rollMode !== 'UNDER') {
      throw new BadRequestException('rollMode must be OVER or UNDER');
    }

    const rollResult = this.fairness.generateRollResult(
      cmd.serverSeed.trim(),
      cmd.clientSeed.trim(),
      cmd.nonce,
    );
    const won = this.fairness.isWin(rollResult, cmd.chance, cmd.rollMode);

    if (
      cmd.expectedRollResult != null &&
      Number.isFinite(cmd.expectedRollResult)
    ) {
      const matches = cmd.expectedRollResult === rollResult;
      if (!matches) {
        return {
          verified: false,
          rollResult,
          won,
          chance: cmd.chance,
          rollMode: cmd.rollMode,
          rollMatchesExpected: false,
          message: `Recomputed roll ${rollResult} does not match expected ${cmd.expectedRollResult}.`,
        };
      }
    }

    return {
      verified: true,
      rollResult,
      won,
      chance: cmd.chance,
      rollMode: cmd.rollMode,
      rollMatchesExpected:
        cmd.expectedRollResult != null
          ? cmd.expectedRollResult === rollResult
          : undefined,
      message: 'Dice roll verified.',
    };
  }
}
