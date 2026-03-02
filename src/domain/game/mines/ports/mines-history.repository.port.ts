/**
 * A single completed (or in-flight) Mines round as a pure domain record.
 * All Prisma types are mapped away before this leaves the infrastructure layer.
 */
export interface MinesHistoryRecord {
  id: string;
  username: string;
  status: string;
  betAmount: number;
  profit: number | null;
  multiplier: number | null;
  gridSize: number;
  minesCount: number;
  nonce: number;
  revealedTiles: number[];
  minePositions: number[];
  cashoutTile: number | null;
  minesHit: number | null;
  createdAt: Date;
}

export interface MinesHistoryPage {
  items: MinesHistoryRecord[];
  total: number;
}

export type MinesHistorySortOrder = 'desc' | 'asc';

export interface IMinesHistoryRepository {
  /**
   * Returns a paginated slice of a user's mines rounds.
   * Defaults to newest-first (`desc`); pass `order: 'asc'` for oldest-first.
   */
  findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
  ): Promise<MinesHistoryPage>;

  /**
   * Fetches a single round by its game ID, enforcing that it belongs to the
   * requesting user.  Returns null if the round does not exist or the
   * username does not match.
   */
  findByIdAndUsername(gameId: string, username: string): Promise<MinesHistoryRecord | null>;
}
