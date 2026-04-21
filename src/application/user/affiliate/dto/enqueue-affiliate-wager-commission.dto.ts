import type { AffiliateWagerCommissionJobGame } from './affiliate-wager-commission.job.dto';

export type EnqueueAffiliateWagerCommissionDto = {
  readonly bettorUsername: string;
  readonly wagerAmount: number;
  readonly sourceEventId: string;
  readonly game: AffiliateWagerCommissionJobGame;
};
