/**
 * Immutable value object holding the fraction of each wager that
 * flows into each rakeback pool.
 *
 * Rates scale with the user's level tier.  The split between pools
 * is always 50 % daily / 30 % weekly / 20 % monthly.
 *
 * ┌──────────────┬───────┬───────────────┐
 * │ Tier         │ Level │ Total Rate    │
 * ├──────────────┼───────┼───────────────┤
 * │ Iron         │  0–9  │ 0.30 %        │
 * │ Bronze       │ 10–19 │ 0.40 %        │
 * │ Silver       │ 20–29 │ 0.50 %        │
 * │ Gold         │ 30–39 │ 0.60 %        │
 * │ Amethyst     │ 40–49 │ 0.75 %        │
 * │ Sapphire     │ 50–59 │ 0.90 %        │
 * │ Emerald      │ 60–69 │ 1.10 %        │
 * │ Topaz        │ 70–79 │ 1.35 %        │
 * │ Spinel       │ 80–89 │ 1.65 %        │
 * │ Alexandrite  │ 90+   │ 2.00 %        │
 * └──────────────┴───────┴───────────────┘
 */

const TIER_RATES: readonly number[] = [
  0.003, // Iron         0–9
  0.004, // Bronze      10–19
  0.005, // Silver      20–29
  0.006, // Gold        30–39
  0.0075, // Amethyst    40–49
  0.009, // Sapphire    50–59
  0.011, // Emerald     60–69
  0.0135, // Topaz       70–79
  0.0165, // Spinel      80–89
  0.02, // Alexandrite 90+
];

const DAILY_SPLIT = 0.5;
const WEEKLY_SPLIT = 0.3;
const MONTHLY_SPLIT = 0.2;

export class RakebackRates {
  private constructor(
    readonly daily: number,
    readonly weekly: number,
    readonly monthly: number,
  ) {}

  /** Returns tier-scaled rates for the given user level (0–100). */
  static forLevel(level: number): RakebackRates {
    const tierIndex = Math.min(
      Math.floor(Math.max(level, 0) / 10),
      TIER_RATES.length - 1,
    );
    const total = TIER_RATES[tierIndex];
    return new RakebackRates(
      total * DAILY_SPLIT,
      total * WEEKLY_SPLIT,
      total * MONTHLY_SPLIT,
    );
  }

  /**
   * Rakeback pool **amounts** from net loss using the same tier fractions as wager-based accrual.
   * Tier table unchanged — only the base is `netLoss` instead of wager.
   */
  static calculateFromLoss(
    level: number,
    netLoss: number,
  ): { daily: number; weekly: number; monthly: number; total: number } {
    const nl = Math.max(0, Number.isFinite(netLoss) ? netLoss : 0);
    const rates = RakebackRates.forLevel(level);
    const daily = Math.round(nl * rates.daily * 100) / 100;
    const weekly = Math.round(nl * rates.weekly * 100) / 100;
    const monthly = Math.round(nl * rates.monthly * 100) / 100;
    const total = Math.round((daily + weekly + monthly) * 100) / 100;
    return { daily, weekly, monthly, total };
  }

  static custom(daily: number, weekly: number, monthly: number): RakebackRates {
    if ([daily, weekly, monthly].some((r) => r < 0 || r > 1)) {
      throw new Error('Rakeback rate must be between 0 and 1');
    }
    return new RakebackRates(daily, weekly, monthly);
  }

  get total(): number {
    return this.daily + this.weekly + this.monthly;
  }
}
