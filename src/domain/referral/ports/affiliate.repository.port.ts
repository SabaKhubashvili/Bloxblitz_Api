export const AFFILIATE_REPOSITORY = Symbol('AFFILIATE_REPOSITORY');

export type AffiliateStatsRange =
  | '1d'
  | '7d'
  | '21d'
  | '30d'
  | '60d'
  | '90d'
  | '120d';

export type AffiliateReferralsRange = 'all' | '7d' | '30d' | '90d';

export type AffiliateReferrerSnapshot = {
  /** Canonical `User.username` from DB (case-sensitive FK target). */
  readonly bettorUsername: string;
  readonly referrerUsername: string;
  readonly referralCode: string;
};

export interface UsedReferralCodeRow {
  readonly code: string | null;
  readonly lastChangedAt: Date | null;
}

export interface AffiliateSummaryRow {
  readonly totalUsers: number;
  readonly activeUsers: number;
  readonly newUsers7d: number;
  readonly totalEarned: number;
  /** User's own affiliate code when a Referral row exists; otherwise null. */
  readonly ownReferralCode: string | null;
  readonly claimableAmount: number;
}

export interface AffiliateReferralListItem {
  readonly user: string;
  readonly wagered: number;
  readonly earned: number;
  readonly since: Date;
}

export interface AffiliateReferralListResult {
  readonly items: AffiliateReferralListItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface IAffiliateRepository {
  /**
   * Resolves the affiliate creator for a bettor using `User.username` only (joins `Referral` by `referedBy`).
   */
  findReferrerSnapshotForBettor(
    bettorUsername: string,
  ): Promise<AffiliateReferrerSnapshot | null>;

  getUsedReferralCode(username: string): Promise<UsedReferralCodeRow | null>;

  findReferralByOwnerUsername(
    username: string,
  ): Promise<{ referralCode: string } | null>;

  findReferralByCode(
    code: string,
  ): Promise<{ userUsername: string; referralCode: string } | null>;

  createOwnedReferralCode(
    ownerUsername: string,
    code: string,
  ): Promise<void>;

  updateUserUsedReferralCode(
    username: string,
    code: string,
    now: Date,
  ): Promise<void>;

  claimReferralEarnings(username: string): Promise<
    | { ok: true; claimedAmount: number; newBalance: number }
    | {
        ok: false;
        reason: 'no_referral' | 'nothing_to_claim' | 'below_minimum';
        minimum?: number;
      }
  >;

  getAffiliateChartData(
    ownerUsername: string,
    range: AffiliateStatsRange,
  ): Promise<{ labels: string[]; wagered: number[]; deposited: number[] }>;

  getAffiliateSummary(ownerUsername: string): Promise<AffiliateSummaryRow>;

  listReferrals(params: {
    ownerUsername: string;
    range: AffiliateReferralsRange;
    search: string | undefined;
    page: number;
    limit: number;
  }): Promise<AffiliateReferralListResult>;
}
