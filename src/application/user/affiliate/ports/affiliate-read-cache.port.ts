import type {
  AffiliateStatsOutputDto,
  AffiliateSummaryOutputDto,
  PaginatedReferralsOutputDto,
  UsedReferralCodeOutputDto,
} from '../dto/affiliate.outputs';

export const AFFILIATE_READ_CACHE_PORT = Symbol('AFFILIATE_READ_CACHE_PORT');

/**
 * Redis-backed read-through cache for affiliate HTTP reads.
 * Invalidation is epoch-based: {@link invalidateAllForUser} bumps a monotonic counter so
 * existing keys become unreachable without SCAN.
 */
export interface IAffiliateReadCachePort {
  getInvalidationEpoch(username: string): Promise<number>;

  /**
   * Bumps the invalidation epoch for this user so all prior read keys rot out (TTL) immediately logically.
   */
  invalidateAllForUser(username: string): Promise<void>;

  /** Deduplicated epoch bumps for multiple usernames (e.g. referee + referrer). */
  invalidateAllForUsers(usernames: readonly string[]): Promise<void>;

  getUsedCode(
    username: string,
    epoch: number,
  ): Promise<UsedReferralCodeOutputDto | null>;

  setUsedCode(
    username: string,
    epoch: number,
    value: UsedReferralCodeOutputDto,
  ): Promise<void>;

  getSummary(
    username: string,
    epoch: number,
  ): Promise<AffiliateSummaryOutputDto | null>;

  setSummary(
    username: string,
    epoch: number,
    value: AffiliateSummaryOutputDto,
  ): Promise<void>;

  getStats(
    username: string,
    range: string,
    epoch: number,
  ): Promise<AffiliateStatsOutputDto | null>;

  setStats(
    username: string,
    range: string,
    epoch: number,
    value: AffiliateStatsOutputDto,
  ): Promise<void>;

  getReferrals(
    username: string,
    queryDigest: string,
    epoch: number,
  ): Promise<PaginatedReferralsOutputDto | null>;

  setReferrals(
    username: string,
    queryDigest: string,
    epoch: number,
    value: PaginatedReferralsOutputDto,
  ): Promise<void>;

  tryAcquirePopulateLock(lockToken: string, ttlMs: number): Promise<boolean>;

  releasePopulateLock(lockToken: string): Promise<void>;
}
