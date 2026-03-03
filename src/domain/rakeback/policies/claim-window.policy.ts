const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class ClaimWindowPolicy {
  /** Daily is unlocked if no previous claim or if 24 h have elapsed. */
  static isDailyUnlocked(unlocksAt: Date | null, now: Date): boolean {
    if (!unlocksAt) return true;
    return now.getTime() >= unlocksAt.getTime();
  }

  /** Window-based types (weekly / monthly) are open when now ∈ [unlock, expiry). */
  static isWindowOpen(
    unlocksAt: Date | null,
    expiresAt: Date | null,
    now: Date,
  ): boolean {
    if (!unlocksAt || !expiresAt) return false;
    const t = now.getTime();
    return t >= unlocksAt.getTime() && t < expiresAt.getTime();
  }

  static dailyUnlockAfter(claimTime: Date): Date {
    return new Date(claimTime.getTime() + TWENTY_FOUR_HOURS_MS);
  }

  /** Next Saturday 07:00 UTC strictly after `now`. */
  static nextWeeklyWindowStart(now: Date): Date {
    const d = new Date(now);
    d.setUTCHours(7, 0, 0, 0);
    const dow = d.getUTCDay();
    const daysUntilSat = (6 - dow + 7) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilSat);
    return d;
  }

  /** Next 1st of the month 07:00 UTC strictly after `now`. */
  static nextMonthlyWindowStart(now: Date): Date {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + 1, 1);
    d.setUTCHours(7, 0, 0, 0);
    return d;
  }

  static windowEnd(windowStart: Date): Date {
    return new Date(windowStart.getTime() + TWENTY_FOUR_HOURS_MS);
  }
}
