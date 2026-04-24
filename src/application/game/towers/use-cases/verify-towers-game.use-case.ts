import { BadRequestException, Injectable } from '@nestjs/common';
import { towersDeriveAllGemIndicesByRow } from '../../../../domain/game/towers/towers-fairness.service';
import {
  isTowersAllowedLevels,
  isTowersDifficulty,
  towersGenerateRows,
} from '../../../../domain/game/towers/towers.config';
import type { TowersDifficulty } from '../../../../domain/game/towers/towers.enums';

export interface VerifyTowersGameCommand {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  difficulty: TowersDifficulty;
  levels: number;
  /** Optional: gem index sets per row from bet history for equality check. */
  expectedGemIndicesByRow?: number[][];
}

export interface VerifyTowersGameOutputDto {
  verified: boolean;
  gemIndicesByRow: number[][];
  difficulty: TowersDifficulty;
  levels: number;
  layoutMatchesExpected?: boolean;
  message: string;
}

function rowsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = [...a[i]].sort((x, y) => x - y);
    const rb = [...b[i]].sort((x, y) => x - y);
    if (ra.length !== rb.length) return false;
    for (let j = 0; j < ra.length; j++) {
      if (ra[j] !== rb[j]) return false;
    }
  }
  return true;
}

@Injectable()
export class VerifyTowersGameUseCase {
  execute(cmd: VerifyTowersGameCommand): VerifyTowersGameOutputDto {
    const serverSeed = cmd.serverSeed?.trim();
    const clientSeed = cmd.clientSeed?.trim();

    if (!serverSeed || !clientSeed) {
      throw new BadRequestException('serverSeed and clientSeed are required');
    }
    if (!Number.isInteger(cmd.nonce) || cmd.nonce < 0) {
      throw new BadRequestException('nonce must be a non-negative integer');
    }
    if (!isTowersDifficulty(cmd.difficulty)) {
      throw new BadRequestException('difficulty must be easy, medium, or hard');
    }
    if (!isTowersAllowedLevels(cmd.levels)) {
      throw new BadRequestException('levels must be one of 8, 10, 12, 16');
    }

    const rows = towersGenerateRows(cmd.difficulty, cmd.levels);
    const gemIndicesByRow = towersDeriveAllGemIndicesByRow({
      serverSeed,
      clientSeed,
      nonce: cmd.nonce,
      rows,
    });

    if (cmd.expectedGemIndicesByRow != null) {
      const ok = rowsEqual(gemIndicesByRow, cmd.expectedGemIndicesByRow);
      if (!ok) {
        return {
          verified: false,
          gemIndicesByRow,
          difficulty: cmd.difficulty,
          levels: cmd.levels,
          layoutMatchesExpected: false,
          message: 'Recomputed gem layout does not match the expected rows.',
        };
      }
    }

    return {
      verified: true,
      gemIndicesByRow,
      difficulty: cmd.difficulty,
      levels: cmd.levels,
      layoutMatchesExpected:
        cmd.expectedGemIndicesByRow != null
          ? rowsEqual(gemIndicesByRow, cmd.expectedGemIndicesByRow)
          : undefined,
      message: 'Towers layout verified.',
    };
  }
}
