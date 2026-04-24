/**
 * A single bet record from the unified game history.
 * All Prisma types are mapped away before this leaves the infrastructure layer.
 */
export interface BetHistoryRecord {
  id: string;
  username: string;
  gameType: string;
  status: string;
  betAmount: number;
  profit: number | null;
  multiplier: number | null;
  createdAt: Date;
  /** Game-specific data (mines config, crash cashout, coinflip players, etc.) */
  gameData: Record<string, unknown> | null;
}

export interface BetHistoryPage {
  items: BetHistoryRecord[];
  total: number;
}

export type BetHistorySortOrder = 'desc' | 'asc';

export interface IBetHistoryRepository {
  /**
   * Returns a paginated slice of a user's bet history across all game types.
   * Defaults to newest-first (`desc`); pass `order: 'asc'` for oldest-first.
   */
  findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: BetHistorySortOrder,
    gameType?: string,
  ): Promise<BetHistoryPage>;

  /**
   * Fetches a single bet by its game ID, enforcing that it belongs to the
   * requesting user. Returns null if the bet does not exist or the username
   * does not match.
   */
  findByIdAndUsername(
    gameId: string,
    username: string,
  ): Promise<BetHistoryRecord | null>;
}
