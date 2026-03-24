import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import { caseListFilterCacheHash } from '../case-list-filter-cache-key';
import { normalizeCaseListEntries } from '../case-list-entries-normalize';
import type { ICaseListFilteredReadPort } from '../../../domain/game/case/ports/case-list-filtered-read.port';
import type { CaseListQueryFilter } from '../../../domain/game/case/services/case-list-query.policy';
import type { CaseListEntry } from '../../../domain/game/case/ports/case.repository.port';
import { CASE_FILTERED_LIST_CACHE_TTL_SECONDS } from '../../../application/game/case/case-cache.constants';

@Injectable()
export class CaseListFilteredReadAdapter implements ICaseListFilteredReadPort {
  private readonly logger = new Logger(CaseListFilteredReadAdapter.name);

  /** In-flight DB loads keyed by `${epoch}:${filterHash}` to reduce stampedes. */
  private readonly inflight = new Map<string, Promise<CaseListEntry[]>>();

  constructor(private readonly redis: RedisService) {}

  async load(
    filters: CaseListQueryFilter,
    loadFromDb: () => Promise<CaseListEntry[]>,
  ): Promise<CaseListEntry[]> {
    const filterHash = caseListFilterCacheHash(filters);
    const epoch =
      (await this.redis.getNumber(RedisKeys.cache.casesListFilterEpoch())) ?? 0;
    const key = RedisKeys.cache.casesListFiltered(epoch, filterHash);
    const inflightKey = `${epoch}:${filterHash}`;

    try {
      const cached = await this.redis.get<CaseListEntry[]>(key);
      if (cached !== null && Array.isArray(cached)) {
        this.logger.debug(
          `[CaseListFiltered] hit epoch=${epoch} hash=${filterHash.slice(0, 10)}…`,
        );
        return normalizeCaseListEntries(cached);
      }
    } catch (err) {
      this.logger.warn('[CaseListFiltered] get failed', err);
    }

    const existing = this.inflight.get(inflightKey);
    if (existing) {
      this.logger.debug(
        `[CaseListFiltered] coalesce epoch=${epoch} hash=${filterHash.slice(0, 10)}…`,
      );
      return existing;
    }

    const promise = (async () => {
      try {
        this.logger.debug(
          `[CaseListFiltered] miss epoch=${epoch} hash=${filterHash.slice(0, 10)}…`,
        );
        const rows = await loadFromDb();
        try {
          await this.redis.set(
            key,
            rows,
            CASE_FILTERED_LIST_CACHE_TTL_SECONDS,
          );
        } catch (err) {
          this.logger.warn('[CaseListFiltered] set failed', err);
        }
        return rows;
      } finally {
        this.inflight.delete(inflightKey);
      }
    })();

    this.inflight.set(inflightKey, promise);
    return promise;
  }
}
