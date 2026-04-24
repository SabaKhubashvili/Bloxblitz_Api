import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { GetAffiliateSummaryQuery } from '../dto/get-affiliate-summary.query';
import type { AffiliateSummaryOutputDto } from '../dto/affiliate.outputs';
import { ensureUserExistsForAffiliate } from '../helpers/ensure-user-for-affiliate.helper';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';
import { AFFILIATE_CACHE_POPULATE_LOCK_MS } from '../constants/affiliate-read-cache.ttl';
import { waitForAffiliateCacheHit } from '../helpers/affiliate-cache-stampede.helper';
import { affiliatePopulateLockToken } from '../helpers/affiliate-referrals-cache-digest.helper';

@Injectable()
export class GetAffiliateSummaryUseCase implements IUseCase<
  GetAffiliateSummaryQuery,
  Result<AffiliateSummaryOutputDto, UserNotFoundError>
> {
  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    query: GetAffiliateSummaryQuery,
  ): Promise<Result<AffiliateSummaryOutputDto, UserNotFoundError>> {
    const epoch = await this.affiliateReadCache.getInvalidationEpoch(
      query.username,
    );
    const cached = await this.affiliateReadCache.getSummary(
      query.username,
      epoch,
    );
    if (cached) return Ok(cached);

    const lockToken = affiliatePopulateLockToken([
      'affiliate',
      'summary',
      query.username,
      String(epoch),
    ]);

    if (
      await this.affiliateReadCache.tryAcquirePopulateLock(
        lockToken,
        AFFILIATE_CACHE_POPULATE_LOCK_MS,
      )
    ) {
      try {
        const again = await this.affiliateReadCache.getSummary(
          query.username,
          epoch,
        );
        if (again) return Ok(again);

        const existsUser = await ensureUserExistsForAffiliate(
          this.affiliateRepo,
          query.username,
        );
        if (!existsUser.ok) return Err(existsUser.error);

        const summary = await this.affiliateRepo.getAffiliateSummary(
          query.username,
        );
        await this.affiliateReadCache.setSummary(
          query.username,
          epoch,
          summary,
        );
        return Ok(summary);
      } finally {
        await this.affiliateReadCache.releasePopulateLock(lockToken);
      }
    }

    const waited = await waitForAffiliateCacheHit(() =>
      this.affiliateReadCache.getSummary(query.username, epoch),
    );
    if (waited) return Ok(waited);

    const existsUser = await ensureUserExistsForAffiliate(
      this.affiliateRepo,
      query.username,
    );
    if (!existsUser.ok) return Err(existsUser.error);

    const summary = await this.affiliateRepo.getAffiliateSummary(
      query.username,
    );
    await this.affiliateReadCache.setSummary(query.username, epoch, summary);
    return Ok(summary);
  }
}
