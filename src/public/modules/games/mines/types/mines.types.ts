import { GameStatus } from "@prisma/client";


export interface MinesGame {
  betId?: string;
  gameHistoryId?: string;
  gameId: string;
  mines: number;
  gemsLeft: number;
  mineMask: string;
  revealedMask: string;
  active: boolean;
  status: GameStatus;
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

  seedRotationHistoryId?: string | null;
}
