import type { BetHistorySortOrder } from '../../../../domain/game/bet-history/ports/bet-history.repository.port';

export interface GetBetHistoryQuery {
  username: string;
  page: number;
  limit: number;
  /** Sort direction for `createdAt`. Defaults to `'desc'` (newest first). */
  order: BetHistorySortOrder;
  /** Optional filter by game type (MINES, CRASH, COINFLIP). */
  gameType?: string;
}
