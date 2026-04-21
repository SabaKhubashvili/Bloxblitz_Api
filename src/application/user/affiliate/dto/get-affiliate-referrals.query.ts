import type { AffiliateReferralsRange } from '../../../../domain/referral/ports/affiliate.repository.port';

export interface GetAffiliateReferralsQuery {
  readonly username: string;
  readonly range: AffiliateReferralsRange;
  readonly search?: string;
  readonly page: number;
  readonly limit: number;
}
