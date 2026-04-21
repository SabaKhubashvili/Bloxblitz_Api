import type { AffiliateStatsRange } from '../../../../domain/referral/ports/affiliate.repository.port';

export interface GetAffiliateStatsQuery {
  readonly username: string;
  readonly range: AffiliateStatsRange;
}
