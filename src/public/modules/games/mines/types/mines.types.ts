import { GameOutcome } from '@prisma/client';

export interface MinesGame {
  betId?: string;
  gameId: string;
  mines: number;
  gemsLeft: number;
  mineMask: number;
  revealedMask: number;
  active: boolean;
  outcome: GameOutcome;
  status?: 'INITIALIZING' | "ENDING" | 'PLAYING' | 'CASHED_OUT' | 'BOMBED';
  grid: number;

  betAmount: number;
  revealedTiles: number[];

  creatorUsername: string;
  creatorProfilePicture: string;

  serverSeed?: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;

  multiplier: number;
}
