import type { TowersRowConfig } from '../../../domain/game/towers/towers.config';
import type { TowersDifficulty } from '../../../domain/game/towers/towers.enums';
import type { DiceBetToSave } from '../../../domain/game/dice/ports/dice-history.repository.port';

/** BullMQ queue name (registerQueue / InjectQueue). */
export const GAME_SAVE_QUEUE = 'game-save' as const;

export const TOWERS_SAVE_GAME_JOB_NAME = 'save-game' as const;
export const DICE_SAVE_BET_JOB_NAME = 'save-dice-bet' as const;
export const MINES_SAVE_INITIAL_JOB_NAME = 'save-mines-initial' as const;

/** @deprecated use GAME_SAVE_QUEUE */
export const TOWERS_GAME_SAVE_QUEUE = GAME_SAVE_QUEUE;

export type TowersSaveGameJobData = {
  gameHistoryId: string;
  towersRowId: string;
  userUsername: string;
  betAmount: number;
  difficulty: TowersDifficulty;
  levels: number;
  rowConfigs: TowersRowConfig[];
  picks: (number | null)[];
  multiplierLadder: number[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

/** Same fields as `DiceBetToSave` — job payload for async DB write. */
export type DiceSaveBetJobData = DiceBetToSave;

export type MinesSaveInitialJobData = {
  gameId: string;
  username: string;
  profilePicture: string;
  betAmount: number;
  mineCount: number;
  gridSize: number;
  minePositions: number[];
  nonce: number;
  houseEdge: number;
};

export type GameSaveJobUnion =
  | { name: typeof TOWERS_SAVE_GAME_JOB_NAME; data: TowersSaveGameJobData }
  | { name: typeof DICE_SAVE_BET_JOB_NAME; data: DiceSaveBetJobData }
  | { name: typeof MINES_SAVE_INITIAL_JOB_NAME; data: MinesSaveInitialJobData };
