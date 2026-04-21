import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type { IAffiliateReadCachePort } from '../../../application/user/affiliate/ports/affiliate-read-cache.port';
import { AFFILIATE_CACHE_TTL_SECONDS } from '../../../application/user/affiliate/constants/affiliate-read-cache.ttl';
import type {
  AffiliateStatsOutputDto,
  AffiliateSummaryOutputDto,
  PaginatedReferralsOutputDto,
  UsedReferralCodeOutputDto,
} from '../../../application/user/affiliate/dto/affiliate.outputs';

@Injectable()
export class AffiliateReadCacheAdapter implements IAffiliateReadCachePort {
  private readonly logger = new Logger(AffiliateReadCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getInvalidationEpoch(username: string): Promise<number> {
    try {
      const v = await this.redis.getNumber(
        RedisKeys.cache.affiliate.epoch(username),
      );
      return v ?? 0;
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] epoch read failed for ${username}`,
        err,
      );
      return 0;
    }
  }

  async invalidateAllForUser(username: string): Promise<void> {
    try {
      await this.redis.incr(RedisKeys.cache.affiliate.epoch(username));
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] epoch bump failed for ${username}`,
        err,
      );
    }
  }

  async invalidateAllForUsers(usernames: readonly string[]): Promise<void> {
    const unique = [
      ...new Set(
        usernames.map((u) => u.trim()).filter((u) => u.length > 0),
      ),
    ];
    await Promise.all(
      unique.map((username) => this.invalidateAllForUser(username)),
    );
  }

  async getUsedCode(
    username: string,
    epoch: number,
  ): Promise<UsedReferralCodeOutputDto | null> {
    try {
      const raw = await this.redis.get<unknown>(
        RedisKeys.cache.affiliate.usedCode(username, epoch),
      );
      if (raw == null) return null;
      return this.reviveUsedCode(raw);
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] usedCode read failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setUsedCode(
    username: string,
    epoch: number,
    value: UsedReferralCodeOutputDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.cache.affiliate.usedCode(username, epoch),
        this.serializeUsedCode(value),
        AFFILIATE_CACHE_TTL_SECONDS.usedCode,
      );
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] usedCode write failed for ${username}`,
        err,
      );
    }
  }

  async getSummary(
    username: string,
    epoch: number,
  ): Promise<AffiliateSummaryOutputDto | null> {
    try {
      const raw = await this.redis.get<unknown>(
        RedisKeys.cache.affiliate.summary(username, epoch),
      );
      if (raw == null) return null;
      return raw as AffiliateSummaryOutputDto;
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] summary read failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setSummary(
    username: string,
    epoch: number,
    value: AffiliateSummaryOutputDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.cache.affiliate.summary(username, epoch),
        value,
        AFFILIATE_CACHE_TTL_SECONDS.summary,
      );
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] summary write failed for ${username}`,
        err,
      );
    }
  }

  async getStats(
    username: string,
    range: string,
    epoch: number,
  ): Promise<AffiliateStatsOutputDto | null> {
    try {
      const raw = await this.redis.get<unknown>(
        RedisKeys.cache.affiliate.stats(username, range, epoch),
      );
      if (raw == null) return null;
      return raw as AffiliateStatsOutputDto;
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] stats read failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setStats(
    username: string,
    range: string,
    epoch: number,
    value: AffiliateStatsOutputDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.cache.affiliate.stats(username, range, epoch),
        value,
        AFFILIATE_CACHE_TTL_SECONDS.stats,
      );
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] stats write failed for ${username}`,
        err,
      );
    }
  }

  async getReferrals(
    username: string,
    queryDigest: string,
    epoch: number,
  ): Promise<PaginatedReferralsOutputDto | null> {
    try {
      const raw = await this.redis.get<unknown>(
        RedisKeys.cache.affiliate.referrals(username, queryDigest, epoch),
      );
      if (raw == null) return null;
      return this.reviveReferrals(raw);
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] referrals read failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setReferrals(
    username: string,
    queryDigest: string,
    epoch: number,
    value: PaginatedReferralsOutputDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.cache.affiliate.referrals(username, queryDigest, epoch),
        this.serializeReferrals(value),
        AFFILIATE_CACHE_TTL_SECONDS.referrals,
      );
    } catch (err) {
      this.logger.warn(
        `[AffiliateCache] referrals write failed for ${username}`,
        err,
      );
    }
  }

  async tryAcquirePopulateLock(
    lockToken: string,
    ttlMs: number,
  ): Promise<boolean> {
    try {
      return this.redis.lock(
        RedisKeys.cache.affiliate.populateLock(lockToken),
        ttlMs,
      );
    } catch (err) {
      this.logger.warn('[AffiliateCache] lock acquire failed', err);
      return false;
    }
  }

  async releasePopulateLock(lockToken: string): Promise<void> {
    try {
      await this.redis.unlock(
        RedisKeys.cache.affiliate.populateLock(lockToken),
      );
    } catch (err) {
      this.logger.warn('[AffiliateCache] lock release failed', err);
    }
  }

  private serializeUsedCode(value: UsedReferralCodeOutputDto): unknown {
    return {
      code: value.code,
      lastChangedAt:
        value.lastChangedAt === null ? null : value.lastChangedAt.toISOString(),
    };
  }

  private reviveUsedCode(raw: unknown): UsedReferralCodeOutputDto {
    const o = raw as Record<string, unknown>;
    return {
      code: (o.code as string | null) ?? null,
      lastChangedAt:
        o.lastChangedAt == null
          ? null
          : new Date(String(o.lastChangedAt)),
    };
  }

  private serializeReferrals(value: PaginatedReferralsOutputDto): unknown {
    return {
      ...value,
      items: value.items.map((i) => ({
        ...i,
        since: i.since.toISOString(),
      })),
    };
  }

  private reviveReferrals(raw: unknown): PaginatedReferralsOutputDto {
    const o = raw as Record<string, unknown>;
    const items = o.items as Array<Record<string, unknown>>;
    return {
      items: items.map((i) => ({
        user: String(i.user),
        wagered: Number(i.wagered),
        earned: Number(i.earned),
        since: new Date(String(i.since)),
      })),
      total: Number(o.total),
      page: Number(o.page),
      limit: Number(o.limit),
      totalPages: Number(o.totalPages),
    };
  }
}
