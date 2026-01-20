
export interface MinesGame {
  id: string;
  mines: number;
  gemsLeft: number;
  mineMask: number; 
  revealedMask: number;
  active: boolean;
  gameResult?: 'won' | 'lost' | 'cashed_out';
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
