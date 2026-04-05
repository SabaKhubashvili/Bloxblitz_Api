import type { DiceHistoryOutputDto } from '../dto/dice-history.output-dto';
import type { DiceHistorySortOrder } from '../../../../domain/game/dice/ports/dice-history.repository.port';

/**
 * Short-lived read cache for the dice history list endpoint.
 *
 * Page keys embed a per-user version counter — {@link invalidate} increments
 * it in O(1) whenever a new roll is persisted so cached pages never stay stale.
 */
export interface IDiceHistoryCachePort {
  getPage(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
  ): Promise<DiceHistoryOutputDto | null>;

  setPage(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
    data: DiceHistoryOutputDto,
    ttlSeconds?: number,
  ): Promise<void>;

  invalidate(username: string): Promise<void>;
}
