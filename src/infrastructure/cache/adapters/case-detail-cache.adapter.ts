import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { ICaseDetailCachePort } from '../../../domain/game/case/ports/case-detail-cache.port';
import type { CaseDetailRecord } from '../../../domain/game/case/ports/case.repository.port';

@Injectable()
export class CaseDetailCacheAdapter implements ICaseDetailCachePort {
  private readonly logger = new Logger(CaseDetailCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async get(slug: string): Promise<CaseDetailRecord | null> {
    try {
      return await this.redis.get<CaseDetailRecord>(
        RedisKeys.cache.caseDetail(slug),
      );
    } catch (err) {
      this.logger.warn(`[CaseDetailCache] get failed slug=${slug}`, err);
      return null;
    }
  }

  async set(
    slug: string,
    record: CaseDetailRecord,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.cache.caseDetail(slug),
        record,
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`[CaseDetailCache] set failed slug=${slug}`, err);
    }
  }
}
