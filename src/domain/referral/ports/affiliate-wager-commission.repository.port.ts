import type { GameType } from '@prisma/client';

export const AFFILIATE_WAGER_COMMISSION_REPOSITORY = Symbol(
  'AFFILIATE_WAGER_COMMISSION_REPOSITORY',
);

export type ApplyAffiliateWagerCommissionInput = {
  readonly idempotencyKey: string;
  readonly bettorUsername: string;
  readonly referrerUsername: string;
  readonly referralCode: string;
  readonly wagerAmount: number;
  readonly commissionAmount: number;
  readonly game: GameType;
};

export type ApplyAffiliateWagerCommissionResult = 'applied' | 'duplicate';

export interface IAffiliateWagerCommissionRepository {
  applyCommissionIfNew(
    input: ApplyAffiliateWagerCommissionInput,
  ): Promise<ApplyAffiliateWagerCommissionResult>;
}
