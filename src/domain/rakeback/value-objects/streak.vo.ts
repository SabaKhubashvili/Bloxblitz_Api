/**
 * Read-only snapshot of a streak for a single rakeback type.
 * Used in output DTOs — not for mutation.
 */
export class Streak {
  constructor(
    readonly count: number,
    readonly longestStreak: number,
    readonly lastStreakDate: Date | null,
    readonly multiplier: number,
  ) {}

  get currentPercent(): number {
    return Math.min(this.count * this.multiplier, 1.0);
  }

  get progressPercent(): number {
    return Math.min(this.count * this.multiplier * 100, 100);
  }
}
