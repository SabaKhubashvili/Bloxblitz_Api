import type { TowersRowConfig } from '../../../../domain/game/towers/towers.config';
import type { TowersMultiplierLaddersPreview } from '../../../../domain/game/towers/towers-multiplier.service';

/**
 * Client-safe game state. Never includes serverSeed, nonce, or hashes — those
 * stay server-side to prevent prediction of future outcomes on a shared seed.
 */
export type TowersGamePublicDto = {
  gameId: string;
  betAmount: number;
  difficulty: string;
  levels: number;
  rows: TowersRowConfig[];
  status: string;
  currentRowIndex: number;
  currentMultiplier: number;
  picks: (number | null)[];
  multiplierLadder: number[];
  nextMultiplierIfSuccess: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Revealed gem positions only (derived server-side). No seeds or nonces. */
export type TowersBoardRevealDto = {
  gemIndicesByRow: number[][];
};

export type TowersRevealResponseDto = {
  game: TowersGamePublicDto;
  outcome: 'gem' | 'bomb';
  payout?: number;
  verification?: TowersBoardRevealDto;
};

export type TowersCashoutResponseDto = {
  game: TowersGamePublicDto;
  payout: number;
  verification: TowersBoardRevealDto;
};

/**
 * GET /games/towers/active — `multiplierLadders` always included.
 * With a valid JWT, `game` is the user’s active run if any; without auth, only ladders are returned (`game` null, no Redis/DB active lookup).
 */
export type TowersActiveGameResponseDto = {
  game: TowersGamePublicDto | null;
  multiplierLadders: TowersMultiplierLaddersPreview;
};

/** POST /games/towers/start — game plus same preview for client cache. */
export type TowersStartGameResponseDto = {
  game: TowersGamePublicDto;
  multiplierLadders: TowersMultiplierLaddersPreview;
};
