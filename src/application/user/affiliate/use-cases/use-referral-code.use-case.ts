import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import {
  ReferralCodeNotFoundError,
  ReferralSelfReferralError,
  ReferralUseCooldownError,
  type ReferralError,
} from '../../../../domain/referral/errors/referral.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { UseReferralCodeCommand } from '../dto/use-referral-code.command';
import type { UsedReferralCodeOutputDto } from '../dto/affiliate.outputs';
import { normalizeReferralCode } from '../helpers/normalize-referral-code.helper';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';

const REFERRAL_USE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UseReferralCodeUseCase implements IUseCase<
  UseReferralCodeCommand,
  Result<UsedReferralCodeOutputDto, ReferralError | UserNotFoundError>
> {
  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    cmd: UseReferralCodeCommand,
  ): Promise<
    Result<UsedReferralCodeOutputDto, ReferralError | UserNotFoundError>
  > {
    const normalized = normalizeReferralCode(cmd.code);
    if (!normalized.ok) return normalized;

    const codeToUse = normalized.value;

    const selfReferral = await this.affiliateRepo.findReferralByOwnerUsername(
      cmd.username,
    );
    if (selfReferral && selfReferral.referralCode.toLowerCase() === codeToUse) {
      return Err(new ReferralSelfReferralError());
    }

    const existingUser = await this.affiliateRepo.getUsedReferralCode(
      cmd.username,
    );
    if (!existingUser) return Err(new UserNotFoundError(cmd.username));

    if (existingUser.code?.toLowerCase() === codeToUse) {
      return Ok({
        code: existingUser.code,
        lastChangedAt: existingUser.lastChangedAt,
      });
    }

    const now = new Date();
    if (existingUser.lastChangedAt) {
      const elapsed = now.getTime() - existingUser.lastChangedAt.getTime();
      if (elapsed < REFERRAL_USE_COOLDOWN_MS) {
        const next = new Date(
          existingUser.lastChangedAt.getTime() + REFERRAL_USE_COOLDOWN_MS,
        );
        return Err(new ReferralUseCooldownError(next));
      }
    }

    const target = await this.affiliateRepo.findReferralByCode(codeToUse);
    if (!target) {
      return Err(new ReferralCodeNotFoundError());
    }

    if (target.userUsername === cmd.username) {
      return Err(new ReferralSelfReferralError());
    }

    await this.affiliateRepo.updateUserUsedReferralCode(
      cmd.username,
      codeToUse,
      now,
    );

    await this.affiliateReadCache.invalidateAllForUsers([
      cmd.username,
      target.userUsername,
    ]);

    return Ok({
      code: codeToUse,
      lastChangedAt: now,
    });
  }
}
