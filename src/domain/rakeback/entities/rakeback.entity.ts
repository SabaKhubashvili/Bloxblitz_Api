import { Result, Ok, Err } from '../../shared/types/result.type';
import { RakebackType } from '../enums/rakeback-type.enum';
import { ClaimWindowPolicy } from '../policies/claim-window.policy';
import { DailyClaimPolicy } from '../policies/daily-claim.policy';
import {
  RakebackNotUnlockedError,
  RakebackWindowClosedError,
  RakebackAlreadyClaimedError,
  ZeroRakebackBalanceError,
  type RakebackError,
} from '../errors/rakeback.errors';

// ── Result types ─────────────────────────────────────────────────────────────

export interface ClaimResult {
  type: RakebackType;
  amount: number;
  streak: number;
  streakPercent: number;
  streakReset: boolean;
  nextClaimAvailableAt: Date;
}

export interface RakebackTypeInfo {
  type: RakebackType;
  totalAccumulated: number;
  claimableAmount: number;
  isClaimable: boolean;
  nextClaimAvailableAt: Date | null;
  streak: number;
  streakProgressPercent?: number;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface RakebackProps {
  id: string;
  username: string;

  dailyAccrued: number;
  weeklyAccrued: number;
  monthlyAccrued: number;

  dailyClaimable: number;
  weeklyClaimable: number;
  monthlyClaimable: number;

  dailyUnlocksAt: Date | null;
  weeklyUnlocksAt: Date | null;
  weeklyExpiresAt: Date | null;
  monthlyUnlocksAt: Date | null;
  monthlyExpiresAt: Date | null;

  lastDailyClaim: Date | null;
  lastWeeklyClaim: Date | null;
  lastMonthlyClaim: Date | null;

  dailyStreak: number;
  dailyLongestStreak: number;
  dailyLastStreakDate: Date | null;
  dailyStreakMultiplier: number;

  weeklyStreak: number;
  weeklyLongestStreak: number;
  weeklyLastStreakDate: Date | null;
  weeklyStreakMultiplier: number;

  monthlyStreak: number;
  monthlyLongestStreak: number;
  monthlyLastStreakDate: Date | null;
  monthlyStreakMultiplier: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Aggregate Root ───────────────────────────────────────────────────────────

export class Rakeback {
  id: string;
  username: string;

  dailyAccrued: number;
  weeklyAccrued: number;
  monthlyAccrued: number;

  dailyClaimable: number;
  weeklyClaimable: number;
  monthlyClaimable: number;

  dailyUnlocksAt: Date | null;
  weeklyUnlocksAt: Date | null;
  weeklyExpiresAt: Date | null;
  monthlyUnlocksAt: Date | null;
  monthlyExpiresAt: Date | null;

  lastDailyClaim: Date | null;
  lastWeeklyClaim: Date | null;
  lastMonthlyClaim: Date | null;

  dailyStreak: number;
  dailyLongestStreak: number;
  dailyLastStreakDate: Date | null;
  dailyStreakMultiplier: number;

  weeklyStreak: number;
  weeklyLongestStreak: number;
  weeklyLastStreakDate: Date | null;
  weeklyStreakMultiplier: number;

  monthlyStreak: number;
  monthlyLongestStreak: number;
  monthlyLastStreakDate: Date | null;
  monthlyStreakMultiplier: number;

  private constructor(props: RakebackProps) {
    Object.assign(this, props);
  }

  static create(username: string): Rakeback {
    return new Rakeback({
      id: crypto.randomUUID(),
      username,
      dailyAccrued: 0,
      weeklyAccrued: 0,
      monthlyAccrued: 0,
      dailyClaimable: 0,
      weeklyClaimable: 0,
      monthlyClaimable: 0,
      dailyUnlocksAt: null,
      weeklyUnlocksAt: null,
      weeklyExpiresAt: null,
      monthlyUnlocksAt: null,
      monthlyExpiresAt: null,
      lastDailyClaim: null,
      lastWeeklyClaim: null,
      lastMonthlyClaim: null,
      dailyStreak: 0,
      dailyLongestStreak: 0,
      dailyLastStreakDate: null,
      dailyStreakMultiplier: 0.05,
      weeklyStreak: 0,
      weeklyLongestStreak: 0,
      weeklyLastStreakDate: null,
      weeklyStreakMultiplier: 0.05,
      monthlyStreak: 0,
      monthlyLongestStreak: 0,
      monthlyLastStreakDate: null,
      monthlyStreakMultiplier: 0.05,
    });
  }

  static fromPersistence(props: RakebackProps): Rakeback {
    return new Rakeback(props);
  }

  // ── Accumulation ─────────────────────────────────────────────────────────

  accumulate(daily: number, weekly: number, monthly: number): void {
    this.dailyAccrued = round2(this.dailyAccrued + daily);
    this.weeklyAccrued = round2(this.weeklyAccrued + weekly);
    this.monthlyAccrued = round2(this.monthlyAccrued + monthly);
  }

  // ── Claim dispatch ───────────────────────────────────────────────────────

  claim(type: RakebackType, now: Date): Result<ClaimResult, RakebackError> {
    console.log(
      `Claiming rakeback for user ${this.username} of type ${type}, ${JSON.stringify(this)}`,
    );
    switch (type) {
      case RakebackType.DAILY:
        return this.claimDaily(now);
      case RakebackType.WEEKLY:
        return this.claimWeekly(now);
      case RakebackType.MONTHLY:
        return this.claimMonthly(now);
    }
  }

  // ── Read-only info (for GET endpoint) ────────────────────────────────────

  getInfo(type: RakebackType, now: Date): RakebackTypeInfo {
    switch (type) {
      case RakebackType.DAILY:
        return this.getDailyInfo(now);
      case RakebackType.WEEKLY:
        return this.getWeeklyInfo(now);
      case RakebackType.MONTHLY:
        return this.getMonthlyInfo(now);
    }
  }

  // ── Private: Daily ───────────────────────────────────────────────────────

  private claimDaily(now: Date): Result<ClaimResult, RakebackError> {
    if (!ClaimWindowPolicy.isDailyUnlocked(this.dailyUnlocksAt, now)) {
      return Err(new RakebackNotUnlockedError('DAILY'));
    }

    this.dailyClaimable = round2(this.dailyClaimable + this.dailyAccrued);
    this.dailyAccrued = 0;

    if (this.dailyClaimable <= 0) {
      return Err(new ZeroRakebackBalanceError('DAILY'));
    }

    const streakReset = DailyClaimPolicy.isStreakBroken(
      this.lastDailyClaim,
      now,
    );
    if (streakReset) this.dailyStreak = 0;

    this.dailyStreak += 1;

    const percent = DailyClaimPolicy.calculateClaimPercent(
      this.dailyStreak,
      this.dailyStreakMultiplier,
    );
    const amount = round2(this.dailyClaimable * percent);

    this.dailyClaimable = round2(this.dailyClaimable - amount);
    this.lastDailyClaim = now;
    this.dailyUnlocksAt = ClaimWindowPolicy.dailyUnlockAfter(now);
    this.dailyLastStreakDate = now;
    this.dailyLongestStreak = Math.max(
      this.dailyLongestStreak,
      this.dailyStreak,
    );

    return Ok({
      type: RakebackType.DAILY,
      amount,
      streak: this.dailyStreak,
      streakPercent: percent,
      streakReset,
      nextClaimAvailableAt: this.dailyUnlocksAt,
    });
  }

  private getDailyInfo(now: Date): RakebackTypeInfo {
    const unlocked = ClaimWindowPolicy.isDailyUnlocked(
      this.dailyUnlocksAt,
      now,
    );
    const total = round2(this.dailyAccrued + this.dailyClaimable);
    console.log(
      `Getting daily info for user ${this.username}, ${JSON.stringify(this)}`,
    );

    let previewAmount = 0;
    let previewStreak = this.dailyStreak;

    if (unlocked && total > 0) {
      if (DailyClaimPolicy.isStreakBroken(this.lastDailyClaim, now))
        previewStreak = 0;
      previewStreak += 1;
      const pct = DailyClaimPolicy.calculateClaimPercent(
        previewStreak,
        this.dailyStreakMultiplier,
      );
      previewAmount = round2(total * pct);
    }

    return {
      type: RakebackType.DAILY,
      totalAccumulated: total,
      claimableAmount: previewAmount,
      isClaimable: unlocked && total > 0,
      nextClaimAvailableAt: unlocked ? null : this.dailyUnlocksAt,
      streak: this.dailyStreak,
      streakProgressPercent: Math.min(
        this.dailyStreak * this.dailyStreakMultiplier * 100,
        100,
      ),
    };
  }

  // ── Private: Weekly ──────────────────────────────────────────────────────

  private claimWeekly(now: Date): Result<ClaimResult, RakebackError> {
    if (
      !ClaimWindowPolicy.isWindowOpen(
        this.weeklyUnlocksAt,
        this.weeklyExpiresAt,
        now,
      )
    ) {
      return Err(new RakebackWindowClosedError('WEEKLY'));
    }

    if (
      this.lastWeeklyClaim &&
      this.weeklyUnlocksAt &&
      this.lastWeeklyClaim >= this.weeklyUnlocksAt
    ) {
      return Err(new RakebackAlreadyClaimedError('WEEKLY'));
    }

    if (this.weeklyClaimable <= 0) {
      return Err(new ZeroRakebackBalanceError('WEEKLY'));
    }

    const amount = this.weeklyClaimable;
    this.weeklyClaimable = 0;
    this.weeklyStreak += 1;
    this.lastWeeklyClaim = now;
    this.weeklyLastStreakDate = now;
    this.weeklyLongestStreak = Math.max(
      this.weeklyLongestStreak,
      this.weeklyStreak,
    );

    return Ok({
      type: RakebackType.WEEKLY,
      amount,
      streak: this.weeklyStreak,
      streakPercent: 1.0,
      streakReset: false,
      nextClaimAvailableAt: ClaimWindowPolicy.nextWeeklyWindowStart(now),
    });
  }

  private getWeeklyInfo(now: Date): RakebackTypeInfo {
    const windowOpen = ClaimWindowPolicy.isWindowOpen(
      this.weeklyUnlocksAt,
      this.weeklyExpiresAt,
      now,
    );
    const alreadyClaimed = !!(
      this.lastWeeklyClaim &&
      this.weeklyUnlocksAt &&
      this.lastWeeklyClaim >= this.weeklyUnlocksAt
    );
    const total = round2(this.weeklyAccrued + this.weeklyClaimable);
    const claimable = windowOpen && !alreadyClaimed ? this.weeklyClaimable : 0;

    return {
      type: RakebackType.WEEKLY,
      totalAccumulated: total,
      claimableAmount: claimable,
      isClaimable: windowOpen && !alreadyClaimed && this.weeklyClaimable > 0,
      nextClaimAvailableAt: windowOpen
        ? null
        : ClaimWindowPolicy.nextWeeklyWindowStart(now),
      streak: this.weeklyStreak,
    };
  }

  // ── Private: Monthly ─────────────────────────────────────────────────────

  private claimMonthly(now: Date): Result<ClaimResult, RakebackError> {
    if (
      !ClaimWindowPolicy.isWindowOpen(
        this.monthlyUnlocksAt,
        this.monthlyExpiresAt,
        now,
      )
    ) {
      return Err(new RakebackWindowClosedError('MONTHLY'));
    }

    if (
      this.lastMonthlyClaim &&
      this.monthlyUnlocksAt &&
      this.lastMonthlyClaim >= this.monthlyUnlocksAt
    ) {
      return Err(new RakebackAlreadyClaimedError('MONTHLY'));
    }

    if (this.monthlyClaimable <= 0) {
      return Err(new ZeroRakebackBalanceError('MONTHLY'));
    }

    const amount = this.monthlyClaimable;
    this.monthlyClaimable = 0;
    this.monthlyStreak += 1;
    this.lastMonthlyClaim = now;
    this.monthlyLastStreakDate = now;
    this.monthlyLongestStreak = Math.max(
      this.monthlyLongestStreak,
      this.monthlyStreak,
    );

    return Ok({
      type: RakebackType.MONTHLY,
      amount,
      streak: this.monthlyStreak,
      streakPercent: 1.0,
      streakReset: false,
      nextClaimAvailableAt: ClaimWindowPolicy.nextMonthlyWindowStart(now),
    });
  }

  private getMonthlyInfo(now: Date): RakebackTypeInfo {
    const windowOpen = ClaimWindowPolicy.isWindowOpen(
      this.monthlyUnlocksAt,
      this.monthlyExpiresAt,
      now,
    );
    const alreadyClaimed = !!(
      this.lastMonthlyClaim &&
      this.monthlyUnlocksAt &&
      this.lastMonthlyClaim >= this.monthlyUnlocksAt
    );
    const total = round2(this.monthlyAccrued + this.monthlyClaimable);
    const claimable = windowOpen && !alreadyClaimed ? this.monthlyClaimable : 0;

    return {
      type: RakebackType.MONTHLY,
      totalAccumulated: total,
      claimableAmount: claimable,
      isClaimable: windowOpen && !alreadyClaimed && this.monthlyClaimable > 0,
      nextClaimAvailableAt: windowOpen
        ? null
        : ClaimWindowPolicy.nextMonthlyWindowStart(now),
      streak: this.monthlyStreak,
    };
  }
}
