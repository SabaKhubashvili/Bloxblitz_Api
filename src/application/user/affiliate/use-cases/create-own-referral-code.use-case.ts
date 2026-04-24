import { Injectable, Inject, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import {
  ReferralAlreadyCreatedError,
  ReferralCodeTakenError,
  type ReferralError,
} from '../../../../domain/referral/errors/referral.errors';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '../../../../domain/referral/ports/affiliate.repository.port';
import type { CreateOwnReferralCodeCommand } from '../dto/create-own-referral-code.command';
import type { CreateOwnReferralCodeOutputDto } from '../dto/affiliate.outputs';
import { normalizeReferralCode } from '../helpers/normalize-referral-code.helper';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';

@Injectable()
export class CreateOwnReferralCodeUseCase implements IUseCase<
  CreateOwnReferralCodeCommand,
  Result<CreateOwnReferralCodeOutputDto, ReferralError>
> {
  private readonly logger = new Logger(CreateOwnReferralCodeUseCase.name);

  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliateRepo: IAffiliateRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(
    cmd: CreateOwnReferralCodeCommand,
  ): Promise<Result<CreateOwnReferralCodeOutputDto, ReferralError>> {
    const normalized = normalizeReferralCode(cmd.code);
    if (!normalized.ok) return normalized;

    const code = normalized.value;

    const existing = await this.affiliateRepo.findReferralByOwnerUsername(
      cmd.username,
    );
    if (existing) {
      return Err(new ReferralAlreadyCreatedError());
    }

    const taken = await this.affiliateRepo.findReferralByCode(code);
    if (taken) {
      return Err(new ReferralCodeTakenError());
    }

    try {
      await this.affiliateRepo.createOwnedReferralCode(cmd.username, code);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const targets = (e.meta?.target as string[] | undefined) ?? [];
        if (targets.includes('referralCode')) {
          return Err(new ReferralCodeTakenError());
        }
        if (targets.includes('userUsername')) {
          return Err(new ReferralAlreadyCreatedError());
        }
        return Err(new ReferralCodeTakenError());
      }
      this.logger.error(
        `createOwnedReferralCode failed for ${cmd.username}`,
        e instanceof Error ? e.stack : e,
      );
      throw e;
    }

    await this.affiliateReadCache.invalidateAllForUser(cmd.username);

    return Ok({ code, createdAt: new Date() });
  }
}
