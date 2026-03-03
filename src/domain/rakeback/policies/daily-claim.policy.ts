const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export class DailyClaimPolicy {
  /**
   * Streak is considered broken if >48 h have elapsed since the last claim.
   * First-ever claim (lastClaim === null) is never considered broken.
   */
  static isStreakBroken(lastClaim: Date | null, now: Date): boolean {
    if (!lastClaim) return false;
    return now.getTime() - lastClaim.getTime() > FORTY_EIGHT_HOURS_MS;
  }

  /**
   * Claimable percentage = min(streak × multiplier, 1.0).
   * With the default multiplier of 0.05, streak 20 → 100 %.
   */
  static calculateClaimPercent(streak: number, multiplier: number): number {
    return Math.min(streak * multiplier, 1.0);
  }
}
