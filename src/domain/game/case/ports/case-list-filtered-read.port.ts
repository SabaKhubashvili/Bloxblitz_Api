import type { CaseListQueryFilter } from '../services/case-list-query.policy';
import type { CaseListEntry } from './case.repository.port';

/**
 * Read-through cache for filtered case catalog queries.
 * Implementations live in infrastructure (Redis, key hashing, coalescing).
 */
export interface ICaseListFilteredReadPort {
  /**
   * Returns rows from cache when possible; otherwise runs `loadFromDb` once
   * (with optional in-flight coalescing) and populates the cache.
   */
  load(
    filters: CaseListQueryFilter,
    loadFromDb: () => Promise<CaseListEntry[]>,
  ): Promise<CaseListEntry[]>;
}
