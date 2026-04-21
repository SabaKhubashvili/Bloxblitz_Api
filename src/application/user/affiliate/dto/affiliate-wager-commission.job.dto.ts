/**
 * BullMQ payload for {@link AFFILIATE_WAGER_COMMISSION_QUEUE}.
 * Snapshot at enqueue time: referrer is whoever owned the code when the bet settled in-game.
 */
export type AffiliateWagerCommissionJobDto = {
  readonly bettorUsername: string;
  readonly referrerUsername: string;
  readonly referralCode: string;
  /** Rounded wager (e.g. dice bet) in account currency. */
  readonly wagerAmount: number;
  /** Rounded commission; see {@link computeAffiliateWagerCommissionAmount}. */
  readonly commissionAmount: number;
  readonly game: AffiliateWagerCommissionJobGame;
  /** Stable per-bet id (e.g. dice bet UUID). */
  readonly sourceEventId: string;
};

export type AffiliateWagerCommissionJobGame =
  | 'DICE'
  | 'MINES'
  | 'CASE'
  | 'TOWERS'
  | 'CRASH'
  | 'ROULETTE'
  | 'COINFLIP'
  | 'JACKPOT';
