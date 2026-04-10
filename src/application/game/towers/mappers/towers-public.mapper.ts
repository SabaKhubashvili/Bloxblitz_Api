import { TowersGameStatus } from '@prisma/client';
import type {
  TowersBoardRevealDto,
  TowersGamePublicDto,
} from '../dto/towers-game-public.dto';
import type { TowersGameEntity } from '../../../../infrastructure/persistance/repositories/game/towers-game.types';
import { towersDeriveAllGemIndicesByRow } from '../../../../domain/game/towers/towers-fairness.service';

function apiStatus(s: TowersGameStatus): string {
  switch (s) {
    case TowersGameStatus.ACTIVE:
      return 'active';
    case TowersGameStatus.LOST:
      return 'lost';
    case TowersGameStatus.CASHED_OUT:
      return 'cashed_out';
    case TowersGameStatus.COMPLETED:
      return 'completed';
    default:
      return 'active';
  }
}

export function toTowersGamePublicDto(entity: TowersGameEntity): TowersGamePublicDto {
  const active = entity.status === TowersGameStatus.ACTIVE;
  const nextIdx = entity.currentRowIndex;
  const ladder = entity.multiplierLadder;
  const nextIf =
    active && nextIdx < entity.levels ? (ladder[nextIdx] ?? null) : null;

  return {
    gameId: entity.gameHistoryId,
    betAmount: entity.betAmount,
    difficulty: entity.difficulty,
    levels: entity.levels,
    rows: entity.rowConfigs,
    status: apiStatus(entity.status),
    currentRowIndex: entity.currentRowIndex,
    currentMultiplier: entity.currentMultiplier,
    picks: entity.picks,
    multiplierLadder: entity.multiplierLadder,
    nextMultiplierIfSuccess: nextIf,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** Full board layout for UI after a terminal; no cryptographic material. */
export function toTowersBoardRevealDto(entity: TowersGameEntity): TowersBoardRevealDto {
  return {
    gemIndicesByRow: towersDeriveAllGemIndicesByRow({
      serverSeed: entity.serverSeed,
      clientSeed: entity.clientSeed,
      nonce: entity.nonce,
      rows: entity.rowConfigs,
    }),
  };
}
