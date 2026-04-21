/**
 * Per-shape TTLs (seconds). Tuned for affiliate reads: short for balance-adjacent
 * fields, longer for chart aggregates.
 */
export const AFFILIATE_CACHE_TTL_SECONDS = {
  /** Used referral code row — changes rarely but must follow code swaps quickly */
  usedCode: 45,
  /** Summary includes claimable amount — keep fresh */
  summary: 35,
  /** Chart series — heavier query */
  stats: 600,
  /** Paginated referrals — list + aggregates */
  referrals: 90,
} as const;

export const AFFILIATE_CACHE_POPULATE_LOCK_MS = 10_000;
