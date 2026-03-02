export interface MinesGameOutputDto {
  id: string;
  username: string;
  betAmount: number;
  mineCount: number;
  gridSize: number;
  status: string;
  revealedTiles: number[];
  multiplier: number;
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
