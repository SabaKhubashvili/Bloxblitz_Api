export interface MinesHistoryItemOutputDto {
  id: string;
  status: string;
  betAmount: number;
  profit: number | null;
  multiplier: number | null;
  /** Side length of the grid for display (e.g. 5 for a 5×5 grid). */
  gridSize: number;
  minesCount: number;
  nonce: number;
  revealedTiles: number[];
  minePositions: number[];
  cashoutTile: number | null;
  minesHit: number | null;
  createdAt: string;
}

export interface MinesHistoryOutputDto {
  items: MinesHistoryItemOutputDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
