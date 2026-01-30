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
  grid: number;

  betAmount: number;
  revealedTiles: number[];

  creatorUsername: string;

  serverSeed?: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;

  multiplier: number;
}
