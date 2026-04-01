export interface MinesGameOutputDto {
  id: string;
  username: string;
  betAmount: number;
  mineCount: number;
  gridSize: number;
  status: string;
  revealedTiles: number[];
  multiplier: number;
  /** Payout multiplier if the next click reveals a gem (`null` if none left or game over). */
  nextRevealMultiplier: number | null;
  nonce: number;
  /** Populated only once the game ends (win or loss). */
  minePositions?: number[];
}

export interface RevealTileOutputDto extends MinesGameOutputDto {
  isMine: boolean;
}

export interface CashoutOutputDto extends MinesGameOutputDto {
  profit: number;
}
