import { createHash } from 'node:crypto';
import type { AffiliateReferralsRange } from '../../../../domain/referral/ports/affiliate.repository.port';

export function affiliateReferralsQueryDigest(input: {
  range: AffiliateReferralsRange;
  search?: string;
  page: number;
  limit: number;
}): string {
  const search = (input.search ?? '').trim().toLowerCase();
  const canonical = JSON.stringify([
    input.range,
    search,
    input.page,
    input.limit,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

export function affiliatePopulateLockToken(parts: string[]): string {
  return createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 40);
}
