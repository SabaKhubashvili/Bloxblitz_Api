/**
 * Pure domain service — no framework dependencies, no side-effects.
 *
 * XP formula (quadratic scaling):
 *   xpRequiredForLevel(n) = XP_BASE * n + XP_SCALE * n²
 *   where XP_BASE = 100, XP_SCALE = 10
 *
 * Resulting milestones (cumulative XP):
 *   Level 10  →    2 000 XP
 *   Level 25  →   8 750 XP
 *   Level 50  →  30 000 XP
 *   Level 75  →  63 750 XP
 *   Level 100 → 110 000 XP
 *
 * Inverse (level from XP) via quadratic formula:
 *   n = (-XP_BASE + sqrt(XP_BASE² + 4 * XP_SCALE * totalXp)) / (2 * XP_SCALE)
 */
export class XpCalculationDomainService {
  private static readonly XP_BASE  = 100;
  private static readonly XP_SCALE = 10;

  /**
   * Minimum cumulative XP needed to reach `level`.
   * Level 0 requires 0 XP.
   */
  static xpRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    return XpCalculationDomainService.XP_BASE * level
      + XpCalculationDomainService.XP_SCALE * level * level;
  }

  /**
   * Derives the current level (0–100) from a cumulative XP total.
   * Result is always clamped to [0, 100].
   */
  static calculateLevelFromXp(totalXp: number): number {
    if (totalXp <= 0) return 0;
    const b = XpCalculationDomainService.XP_BASE;
    const s = XpCalculationDomainService.XP_SCALE;
    const rawLevel = Math.floor((-b + Math.sqrt(b * b + 4 * s * totalXp)) / (2 * s));
    return Math.max(0, Math.min(100, rawLevel));
  }

  /**
   * Returns XP progress within the current level as absolute and relative values.
   *
   * Accepts the **stored** currentLevel so the progress window is always
   * anchored to the correct tier boundary, even when totalXp has grown
   * beyond what the formula would calculate from scratch (e.g. legacy data
   * or manual level overrides).
   *
   * - currentLevelXp : XP earned since the floor of currentLevel, clamped to [0, nextLevelXp]
   * - nextLevelXp    : XP needed to cross from currentLevel to currentLevel + 1
   * - progress       : fraction in [0, 1]
   *
   * At level 100 (max), all values reflect a completed bar (progress = 1).
   */
  static xpProgressInLevel(
    totalXp: number,
    currentLevel: number,
  ): {
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
  } {
    if (currentLevel >= 100) {
      const floor = XpCalculationDomainService.xpRequiredForLevel(100);
      return { currentLevelXp: floor, nextLevelXp: floor, progress: 1 };
    }

    const currentFloor   = XpCalculationDomainService.xpRequiredForLevel(currentLevel);
    const nextFloor      = XpCalculationDomainService.xpRequiredForLevel(currentLevel + 1);
    const nextLevelXp    = nextFloor - currentFloor;
    // Clamp XP within [0, nextLevelXp] so stale/inflated totalXp never
    // produces a negative gap or an XP value larger than the tier window.
    const rawProgress    = totalXp - currentFloor;
    const currentLevelXp = Math.max(0, Math.min(rawProgress, nextLevelXp));
    const progress       = nextLevelXp > 0 ? currentLevelXp / nextLevelXp : 1;
    return { currentLevelXp, nextLevelXp, progress };
  }
}
