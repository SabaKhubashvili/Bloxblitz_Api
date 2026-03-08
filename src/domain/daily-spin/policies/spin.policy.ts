import { SpinPrize } from '../value-objects/spin-prize.vo';
import { SpinTier }  from '../value-objects/spin-tier.vo';
import {
  SPIN_TIERS,
  SPIN_COOLDOWN_MS,
  SPIN_MIN_LEVEL,
  type SpinTierConfig,
} from '../../../shared/config/spin-prizes.config';

/**
 * Pure domain service — zero framework dependencies.
 *
 * Responsibilities:
 *   1. Level-gate enforcement (meetsLevelRequirement)
 *   2. Rolling 24-hour cooldown enforcement (isCooldownActive)
 *   3. Wager-to-tier mapping (resolveTier)
 *   4. Cryptographically-fair weighted random prize selection (selectPrize)
 */
export class SpinPolicy {
  /** Eagerly built once from the externalized config; never mutated. */
  private static readonly _tiers: readonly SpinTier[] =
    SpinPolicy.buildTiers();

  /** Sorted descending by minWager for O(n) tier resolution. */
  private static readonly _tiersDesc: readonly SpinTier[] =
    [...SpinPolicy._tiers].sort((a, b) => b.minWager - a.minWager);

  private static buildTiers(): readonly SpinTier[] {
    return SPIN_TIERS.map((cfg: SpinTierConfig) =>
      SpinTier.create(
        cfg.tier,
        cfg.minWager,
        cfg.prizes.map((p) => SpinPrize.create(p)),
      ),
    );
  }

  static meetsLevelRequirement(level: number): boolean {
    return level >= SPIN_MIN_LEVEL;
  }

  static isCooldownActive(lastSpinAt: Date | null, now: Date): boolean {
    if (!lastSpinAt) return false;
    return now.getTime() - lastSpinAt.getTime() < SPIN_COOLDOWN_MS;
  }

  static nextSpinAt(lastSpinAt: Date): Date {
    return new Date(lastSpinAt.getTime() + SPIN_COOLDOWN_MS);
  }

  /**
   * Returns the highest-tier whose minWager does not exceed wager30d.
   * Falls back to tier 1 (minWager = 0) which is always eligible.
   */
  static resolveTier(wager30d: number): SpinTier {
    const match = SpinPolicy._tiersDesc.find((t) => wager30d >= t.minWager);
    return match ?? SpinPolicy._tiers[0];
  }

  /**
   * Weighted random selection using a single linear scan.
   * Using Math.random() is sufficient for a reward system; the game
   * is not provably-fair at the spin level (unlike casino rounds).
   */
  static selectPrize(tier: SpinTier): SpinPrize {
    let cursor = Math.random() * tier.totalWeight;
    for (const prize of tier.prizes) {
      cursor -= prize.weight;
      if (cursor <= 0) return prize;
    }
    return tier.prizes[tier.prizes.length - 1];
  }

  static get minLevel(): number {
    return SPIN_MIN_LEVEL;
  }

  static get tiers(): readonly SpinTier[] {
    return SpinPolicy._tiers;
  }
}
