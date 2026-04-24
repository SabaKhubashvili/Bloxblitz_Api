import type {
  MinesHistoryOutputDto,
  MinesHistoryItemOutputDto,
} from '../dto/mines-history.output-dto';
import type { MinesHistorySortOrder } from '../../../../domain/game/mines/ports/mines-history.repository.port';

/**
 * Short-lived read cache for the mines history endpoints.
 *
 * Two cache granularities are provided:
 *  - Page cache  — keyed by username + page + limit + order (list endpoint)
 *  - Round cache — keyed by gameId (detail endpoint)
 *
 * Both use TTL-based expiry only; no active invalidation is required because
 * the TTL is short enough that newly completed games appear within one window.
 */
export interface IMinesHistoryCachePort {
  getPage(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
  ): Promise<MinesHistoryOutputDto | null>;

  setPage(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
    data: MinesHistoryOutputDto,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Invalidates all cached history pages for a user.
   *
   * Implemented via version counter — O(1), no SCAN/KEYS needed.
   * Call this fire-and-forget whenever a game reaches a terminal state.
   */
  invalidate(username: string): Promise<void>;

  getRound(gameId: string): Promise<MinesHistoryItemOutputDto | null>;

  setRound(
    gameId: string,
    data: MinesHistoryItemOutputDto,
    ttlSeconds?: number,
  ): Promise<void>;
}
