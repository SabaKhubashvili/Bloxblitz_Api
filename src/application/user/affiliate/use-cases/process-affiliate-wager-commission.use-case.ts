import { Inject, Injectable } from '@nestjs/common';
import { GameType } from '@prisma/client';
import type { AffiliateWagerCommissionJobDto } from '../dto/affiliate-wager-commission.job.dto';
import { affiliateWagerCommissionIdempotencyKey } from '../affiliate-wager-commission.queue.constants';
import type { IAffiliateWagerCommissionRepository } from '../../../../domain/referral/ports/affiliate-wager-commission.repository.port';
import { AFFILIATE_WAGER_COMMISSION_REPOSITORY } from '../../../../domain/referral/ports/affiliate-wager-commission.repository.port';
import {
  AFFILIATE_READ_CACHE_PORT,
  type IAffiliateReadCachePort,
} from '../ports/affiliate-read-cache.port';

@Injectable()
export class ProcessAffiliateWagerCommissionUseCase {
  constructor(
    @Inject(AFFILIATE_WAGER_COMMISSION_REPOSITORY)
    private readonly ledger: IAffiliateWagerCommissionRepository,
    @Inject(AFFILIATE_READ_CACHE_PORT)
    private readonly affiliateReadCache: IAffiliateReadCachePort,
  ) {}

  async execute(job: AffiliateWagerCommissionJobDto): Promise<void> {
    if (job.commissionAmount <= 0) return;
    if (job.bettorUsername === job.referrerUsername) return;

    const game = jobGameToPrisma(job.game);
    const idempotencyKey = affiliateWagerCommissionIdempotencyKey(
      job.game,
      job.sourceEventId,
    );

    const outcome = await this.ledger.applyCommissionIfNew({
      idempotencyKey,
      bettorUsername: job.bettorUsername,
      referrerUsername: job.referrerUsername,
      referralCode: job.referralCode,
      wagerAmount: job.wagerAmount,
      commissionAmount: job.commissionAmount,
      game,
    });

    if (outcome === 'applied') {
      await this.affiliateReadCache.invalidateAllForUser(job.referrerUsername);
    }
  }
}

function jobGameToPrisma(
  game: AffiliateWagerCommissionJobDto['game'],
): GameType {
  switch (game) {
    case 'DICE':
      return GameType.DICE;
    case 'MINES':
      return GameType.MINES;
    case 'CASE':
      return GameType.CASE;
    case 'TOWERS':
      return GameType.TOWERS;
    case 'CRASH':
      return GameType.CRASH;
    case 'ROULETTE':
      return GameType.ROULETTE;
    case 'COINFLIP':
      return GameType.COINFLIP;
    case 'JACKPOT':
      return GameType.JACKPOT;
    default: {
      const _exhaustive: never = game;
      throw new Error(`Unsupported affiliate wager game: ${_exhaustive}`);
    }
  }
}
