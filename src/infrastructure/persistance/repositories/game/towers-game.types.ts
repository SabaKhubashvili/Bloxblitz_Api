import type { TowersDifficulty } from '../../../../domain/game/towers/towers.enums';
import type { TowersRowConfig } from '../../../../domain/game/towers/towers.config';
import type { TowersGameStatus } from '@prisma/client';

export interface TowersGameEntity {
  id: string;
  gameHistoryId: string;
  userUsername: string;
  /** Snapshot at start (JWT) — used for bet feed events; not persisted to Prisma. */
  profilePicture: string;
  betAmount: number;
  difficulty: TowersDifficulty;
  levels: number;
  rowConfigs: TowersRowConfig[];
  status: TowersGameStatus;
  currentRowIndex: number;
  currentMultiplier: number;
  picks: (number | null)[];
  multiplierLadder: number[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: Date;
  updatedAt: Date;
}
