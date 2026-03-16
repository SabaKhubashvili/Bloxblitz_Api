/**
 * Centralized leveling configuration.
 *
 * XP formula (quadratic scaling with progressive growth):
 *   xpRequiredForLevel(n) = XP_BASE * n + XP_SCALE * n²
 *
 * Higher XP_SCALE = steeper curve; each level requires more XP than the last,
 * with the increment growing linearly (higher levels become progressively harder).
 *
 * Calibration:
 *   Level 0 → Level 1 requires LEVEL_0_TO_1_XP (5000) XP.
 *   With XP_BASE=3000, XP_SCALE=2000: xpRequired(1) = 3000 + 2000 = 5000 ✓
 *
 * Resulting milestones (cumulative XP):
 *   Level 1   →     5 000 XP
 *   Level 10  →   230 000 XP
 *   Level 25  →  1 437 500 XP
 *   Level 50  →  5 150 000 XP
 *   Level 75  → 11 437 500 XP
 *   Level 100 → 20 300 000 XP
 *
 * Game XP rates are scaled proportionally so that the relative progression
 * (coins wagered to reach a given level) remains consistent across games.
 */
export const LEVELING_CONFIG = {
  /** XP required to reach level 1 from level 0. */
  LEVEL_0_TO_1_XP: 1000,

  /** Linear coefficient in xpRequired(n) = XP_BASE * n + XP_SCALE * n² */
  XP_BASE: 2000,

  /** Quadratic coefficient — higher value = steeper curve, progressively harder at high levels. */
  XP_SCALE: 2000,

  /**
   * Scale factor for game XP rates.
   * Game rates are multiplied by this to preserve progression balance with the new curve.
   */
  GAME_RATE_SCALE_FACTOR: 5000 / 110,
} as const;
