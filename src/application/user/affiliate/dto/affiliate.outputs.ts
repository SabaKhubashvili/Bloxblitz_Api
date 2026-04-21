export interface UsedReferralCodeOutputDto {
  readonly code: string | null;
  readonly lastChangedAt: Date | null;
}

export interface CreateOwnReferralCodeOutputDto {
  readonly code: string;
  readonly createdAt: Date;
}

export interface AffiliateClaimOutputDto {
  readonly claimedAmount: number;
  readonly newBalance: number;
}

export interface AffiliateStatsOutputDto {
  readonly labels: string[];
  readonly wagered: number[];
  readonly deposited: number[];
}

export interface AffiliateSummaryOutputDto {
  readonly totalUsers: number;
  readonly activeUsers: number;
  readonly newUsers7d: number;
  readonly totalEarned: number;
  readonly ownReferralCode: string | null;
  readonly claimableAmount: number;
}

export interface AffiliateReferralItemOutputDto {
  readonly user: string;
  readonly wagered: number;
  readonly earned: number;
  readonly since: Date;
}

export interface PaginatedReferralsOutputDto {
  readonly items: AffiliateReferralItemOutputDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}
