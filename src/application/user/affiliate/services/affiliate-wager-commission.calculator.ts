/** Product requirement: 1% of referred user wager → creator claimable balance. */
export const AFFILIATE_WAGER_COMMISSION_RATE = 0.01;

export function computeAffiliateWagerCommissionAmount(
  wagerAmount: number,
): number {
  if (!Number.isFinite(wagerAmount) || wagerAmount < 1) return 0;
  return Math.round(wagerAmount * AFFILIATE_WAGER_COMMISSION_RATE * 100) / 100;
}
