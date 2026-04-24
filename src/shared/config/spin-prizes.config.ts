/**
 * Daily Spin prize configuration.
 *
 * Each tier is unlocked by the user's total wager in the past 30 days.
 * Within a tier, 6 prizes are defined with weights that skew heavily toward
 * lower rewards — higher prizes remain aspirational but achievable.
 *
 * To extend tiers: add a new entry maintaining the sorted-ascending minWager
 * invariant. No other file needs to change.
 */

export interface SpinPrizeConfig {
  readonly label: string;
  readonly amount: number;
  /** Relative probability weight. Sum of all weights = totalWeight for the tier. */
  readonly weight: number;
}

export interface SpinTierConfig {
  readonly tier: number;
  /** Minimum 30-day wager (inclusive) required to unlock this tier. */
  readonly minWager: number;
  readonly prizes: readonly SpinPrizeConfig[];
}

/** Rolling cooldown between spins (milliseconds). */
export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Minimum user level to access the daily spin. */
export const SPIN_MIN_LEVEL = 3;

/** Duration of the Redis spin-lock that prevents double-spins (milliseconds). */
export const SPIN_LOCK_TTL_MS = 10_000;

/** TTL for the spin-status Redis cache entry (seconds). */
export const SPIN_STATUS_CACHE_TTL_S = 60;

export const SPIN_TIERS: readonly SpinTierConfig[] = [
  {
    tier: 1,
    minWager: 0,
    prizes: [
      { label: 'Bronze I', amount: 1, weight: 40 },
      { label: 'Bronze II', amount: 2, weight: 25 },
      { label: 'Silver I', amount: 5, weight: 15 },
      { label: 'Silver II', amount: 10, weight: 10 },
      { label: 'Gold I', amount: 25, weight: 7 },
      { label: 'Diamond I', amount: 50, weight: 3 },
    ],
  },
  {
    tier: 2,
    minWager: 1_000,
    prizes: [
      { label: 'Bronze II', amount: 2, weight: 35 },
      { label: 'Silver I', amount: 5, weight: 25 },
      { label: 'Silver II', amount: 10, weight: 18 },
      { label: 'Gold I', amount: 25, weight: 12 },
      { label: 'Gold II', amount: 50, weight: 7 },
      { label: 'Diamond I', amount: 100, weight: 3 },
    ],
  },
  {
    tier: 3,
    minWager: 5_000,
    prizes: [
      { label: 'Silver I', amount: 5, weight: 30 },
      { label: 'Silver II', amount: 10, weight: 25 },
      { label: 'Gold I', amount: 25, weight: 20 },
      { label: 'Gold II', amount: 50, weight: 14 },
      { label: 'Diamond I', amount: 100, weight: 8 },
      { label: 'Diamond II', amount: 250, weight: 3 },
    ],
  },
  {
    tier: 4,
    minWager: 10_000,
    prizes: [
      { label: 'Silver II', amount: 10, weight: 28 },
      { label: 'Gold I', amount: 25, weight: 25 },
      { label: 'Gold II', amount: 50, weight: 20 },
      { label: 'Diamond I', amount: 100, weight: 14 },
      { label: 'Diamond II', amount: 250, weight: 9 },
      { label: 'Elite', amount: 500, weight: 4 },
    ],
  },
  {
    tier: 5,
    minWager: 25_000,
    prizes: [
      { label: 'Gold I', amount: 25, weight: 25 },
      { label: 'Gold II', amount: 50, weight: 22 },
      { label: 'Diamond I', amount: 100, weight: 20 },
      { label: 'Diamond II', amount: 250, weight: 17 },
      { label: 'Elite', amount: 500, weight: 12 },
      { label: 'Legend', amount: 1000, weight: 4 },
    ],
  },
  {
    tier: 6,
    minWager: 50_000,
    prizes: [
      { label: 'Gold II', amount: 50, weight: 23 },
      { label: 'Diamond I', amount: 100, weight: 22 },
      { label: 'Diamond II', amount: 250, weight: 20 },
      { label: 'Elite', amount: 500, weight: 18 },
      { label: 'Legend', amount: 1000, weight: 12 },
      { label: 'Mythic', amount: 2000, weight: 5 },
    ],
  },
  {
    tier: 7,
    minWager: 100_000,
    prizes: [
      { label: 'Diamond I', amount: 100, weight: 22 },
      { label: 'Diamond II', amount: 250, weight: 21 },
      { label: 'Elite', amount: 500, weight: 20 },
      { label: 'Legend', amount: 1000, weight: 18 },
      { label: 'Mythic', amount: 2000, weight: 12 },
      { label: 'Divine', amount: 5000, weight: 7 },
    ],
  },
  {
    tier: 8,
    minWager: 250_000,
    prizes: [
      { label: 'Diamond II', amount: 250, weight: 20 },
      { label: 'Elite', amount: 500, weight: 20 },
      { label: 'Legend', amount: 1000, weight: 20 },
      { label: 'Mythic', amount: 2000, weight: 17 },
      { label: 'Divine', amount: 5000, weight: 15 },
      { label: 'Celestial', amount: 10000, weight: 8 },
    ],
  },
  {
    tier: 9,
    minWager: 500_000,
    prizes: [
      { label: 'Elite', amount: 500, weight: 18 },
      { label: 'Legend', amount: 1000, weight: 20 },
      { label: 'Mythic', amount: 2000, weight: 20 },
      { label: 'Divine', amount: 5000, weight: 20 },
      { label: 'Celestial', amount: 10000, weight: 15 },
      { label: 'Transcendent', amount: 25000, weight: 7 },
    ],
  },
  {
    tier: 10,
    minWager: 1_000_000,
    prizes: [
      { label: 'Legend', amount: 1000, weight: 15 },
      { label: 'Mythic', amount: 2000, weight: 18 },
      { label: 'Divine', amount: 5000, weight: 22 },
      { label: 'Celestial', amount: 10000, weight: 22 },
      { label: 'Transcendent', amount: 25000, weight: 16 },
      { label: 'Immortal', amount: 50000, weight: 7 },
    ],
  },
] as const;
