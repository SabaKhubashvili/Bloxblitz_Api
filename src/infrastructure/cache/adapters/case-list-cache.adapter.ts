import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { ICaseListCachePort } from '../../../domain/game/case/ports/case-list-cache.port';
import type { CaseListEntry } from '../../../domain/game/case/ports/case.repository.port';

@Injectable()
export class CaseListCacheAdapter implements ICaseListCachePort {
  private readonly logger = new Logger(CaseListCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async get(): Promise<CaseListEntry[] | null> {
    try {
      return await this.redis.get<CaseListEntry[]>(RedisKeys.cache.casesList());
    } catch (err) {
      this.logger.warn('[CaseListCache] get failed', err);
      return null;
    }
  }

  async set(entries: CaseListEntry[], ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(RedisKeys.cache.casesList(), entries, ttlSeconds);
    } catch (err) {
      this.logger.warn('[CaseListCache] set failed', err);
    }
  }

  async invalidate(): Promise<void> {
    try {
      await this.redis.del(RedisKeys.cache.casesList());
    } catch (err) {
      this.logger.warn('[CaseListCache] invalidate failed', err);
    }
  }
}
