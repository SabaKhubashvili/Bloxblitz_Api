import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { GetUsedReferralCodeQuery } from '../dto/get-used-referral-code.query';
import type { UsedReferralCodeOutputDto } from '../dto/affiliate.outputs';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';
import { AFFILIATE_CACHE_POPULATE_LOCK_MS } from '../constants/affiliate-read-cache.ttl';
import {
  waitForAffiliateCacheHit,
} from '../helpers/affiliate-cache-stampede.helper';
import { affiliatePopulateLockToken } from '../helpers/affiliate-referrals-cache-digest.helper';

@Injectable()
export class GetUsedReferralCodeUseCase
  implements
    IUseCase<
      GetUsedReferralCodeQuery,
      Result<UsedReferralCodeOutputDto, UserNotFoundError>
    >
{
  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    query: GetUsedReferralCodeQuery,
  ): Promise<Result<UsedReferralCodeOutputDto, UserNotFoundError>> {
    const epoch = await this.affiliateReadCache.getInvalidationEpoch(
      query.username,
    );
    const cached = await this.affiliateReadCache.getUsedCode(
      query.username,
      epoch,
    );
    if (cached) return Ok(cached);

    const lockToken = affiliatePopulateLockToken([
      'affiliate',
      'usedCode',
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
        const again = await this.affiliateReadCache.getUsedCode(
          query.username,
          epoch,
        );
        if (again) return Ok(again);

        const row = await this.affiliateRepo.getUsedReferralCode(query.username);
        if (!row) return Err(new UserNotFoundError(query.username));
        const dto: UsedReferralCodeOutputDto = {
          code: row.code,
          lastChangedAt: row.lastChangedAt,
        };
        await this.affiliateReadCache.setUsedCode(query.username, epoch, dto);
        return Ok(dto);
      } finally {
        await this.affiliateReadCache.releasePopulateLock(lockToken);
      }
    }

    const waited = await waitForAffiliateCacheHit(() =>
      this.affiliateReadCache.getUsedCode(query.username, epoch),
    );
    if (waited) return Ok(waited);

    const row = await this.affiliateRepo.getUsedReferralCode(query.username);
    if (!row) return Err(new UserNotFoundError(query.username));
    const dto: UsedReferralCodeOutputDto = {
      code: row.code,
      lastChangedAt: row.lastChangedAt,
    };
    await this.affiliateReadCache.setUsedCode(query.username, epoch, dto);
    return Ok(dto);
  }
}
