import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { GetAffiliateReferralsQuery } from '../dto/get-affiliate-referrals.query';
import type { PaginatedReferralsOutputDto } from '../dto/affiliate.outputs';
import { ensureUserExistsForAffiliate } from '../helpers/ensure-user-for-affiliate.helper';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';
import { AFFILIATE_CACHE_POPULATE_LOCK_MS } from '../constants/affiliate-read-cache.ttl';
import { waitForAffiliateCacheHit } from '../helpers/affiliate-cache-stampede.helper';
import {
  affiliatePopulateLockToken,
  affiliateReferralsQueryDigest,
} from '../helpers/affiliate-referrals-cache-digest.helper';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class GetAffiliateReferralsUseCase
  implements
    IUseCase<
      GetAffiliateReferralsQuery,
      Result<PaginatedReferralsOutputDto, UserNotFoundError>
    >
{
  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    query: GetAffiliateReferralsQuery,
  ): Promise<Result<PaginatedReferralsOutputDto, UserNotFoundError>> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const digest = affiliateReferralsQueryDigest({
      range: query.range,
      search: query.search,
      page,
      limit,
    });

    const epoch = await this.affiliateReadCache.getInvalidationEpoch(
      query.username,
    );
    const cached = await this.affiliateReadCache.getReferrals(
      query.username,
      digest,
      epoch,
    );
    if (cached) return Ok(cached);

    const lockToken = affiliatePopulateLockToken([
      'affiliate',
      'referrals',
      query.username,
      digest,
      String(epoch),
    ]);

    if (
      await this.affiliateReadCache.tryAcquirePopulateLock(
        lockToken,
        AFFILIATE_CACHE_POPULATE_LOCK_MS,
      )
    ) {
      try {
        const again = await this.affiliateReadCache.getReferrals(
          query.username,
          digest,
          epoch,
        );
        if (again) return Ok(again);

        const existsUser = await ensureUserExistsForAffiliate(
          this.affiliateRepo,
          query.username,
        );
        if (!existsUser.ok) return Err(existsUser.error);

        const dto = await this.loadFromDb(query, page, limit);
        await this.affiliateReadCache.setReferrals(
          query.username,
          digest,
          epoch,
          dto,
        );
        return Ok(dto);
      } finally {
        await this.affiliateReadCache.releasePopulateLock(lockToken);
      }
    }

    const waited = await waitForAffiliateCacheHit(() =>
      this.affiliateReadCache.getReferrals(query.username, digest, epoch),
    );
    if (waited) return Ok(waited);

    const existsUser = await ensureUserExistsForAffiliate(
      this.affiliateRepo,
      query.username,
    );
    if (!existsUser.ok) return Err(existsUser.error);

    const dto = await this.loadFromDb(query, page, limit);
    await this.affiliateReadCache.setReferrals(
      query.username,
      digest,
      epoch,
      dto,
    );
    return Ok(dto);
  }

  private async loadFromDb(
    query: GetAffiliateReferralsQuery,
    page: number,
    limit: number,
  ): Promise<PaginatedReferralsOutputDto> {
    const raw = await this.affiliateRepo.listReferrals({
      ownerUsername: query.username,
      range: query.range,
      search: query.search,
      page,
      limit,
    });

    const totalPages =
      raw.total === 0 ? 0 : Math.ceil(raw.total / raw.limit);

    return {
      items: raw.items.map((i) => ({
        user: i.user,
        wagered: round2(i.wagered),
        earned: round2(i.earned),
        since: i.since,
      })),
      total: raw.total,
      page: raw.page,
      limit: raw.limit,
      totalPages,
    };
  }
}
