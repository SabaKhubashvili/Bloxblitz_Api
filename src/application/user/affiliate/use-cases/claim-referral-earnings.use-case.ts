import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import {
  ReferralBelowMinimumClaimError,
  ReferralNothingToClaimError,
  type ReferralError,
} from '../../../../domain/referral/errors/referral.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { ClaimReferralEarningsCommand } from '../dto/claim-referral-earnings.command';
import type { AffiliateClaimOutputDto } from '../dto/affiliate.outputs';
import { ensureUserExistsForAffiliate } from '../helpers/ensure-user-for-affiliate.helper';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';

@Injectable()
export class ClaimReferralEarningsUseCase
  implements
    IUseCase<
      ClaimReferralEarningsCommand,
      Result<AffiliateClaimOutputDto, ReferralError | UserNotFoundError>
    >
{
  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    cmd: ClaimReferralEarningsCommand,
  ): Promise<Result<AffiliateClaimOutputDto, ReferralError | UserNotFoundError>> {
    const existsUser = await ensureUserExistsForAffiliate(
      this.affiliateRepo,
      cmd.username,
    );
    if (!existsUser.ok) return Err(existsUser.error);

    const result = await this.affiliateRepo.claimReferralEarnings(cmd.username);
    if (result.ok === false) {
      if (result.reason === 'no_referral') {
        return Err(new ReferralNothingToClaimError());
      }
      if (result.reason === 'nothing_to_claim') {
        return Err(new ReferralNothingToClaimError());
      }
      return Err(new ReferralBelowMinimumClaimError(result.minimum ?? 0));
    }

    await this.affiliateReadCache.invalidateAllForUser(cmd.username);

    return Ok({
      claimedAmount: result.claimedAmount,
      newBalance: result.newBalance,
    });
  }
}
