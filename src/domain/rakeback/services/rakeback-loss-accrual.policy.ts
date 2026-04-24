import { RAKEBACK_ANTI_ABUSE } from '../config/rakeback-anti-abuse.config';
import { RakebackRates } from '../value-objects/rakeback-rate.vo';

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Net loss from eligible totals only (non-negative). */
export function netLossFromEligible(
  eligibleWager: number,
  eligibleWon: number,
): number {
  const w = Math.max(0, round2(eligibleWager));
  const o = Math.max(0, round2(eligibleWon));
  return Math.max(0, round2(w - o));
}

export function isEligibleRakebackWager(
  wagerAmount: number,
  minBet: number = RAKEBACK_ANTI_ABUSE.MIN_RAKEBACK_BET,
): boolean {
  return Number.isFinite(wagerAmount) && wagerAmount >= minBet;
}

export function clampEligibleIncrement(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, RAKEBACK_ANTI_ABUSE.MAX_ELIGIBLE_INCREMENT);
}

export interface RakebackPoolAmounts {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
}

/** Delta to apply to each accrued pool when net loss moves from prev → next (same level). */
export function accrualDeltaForNetLossChange(
  userLevel: number,
  prevNetLoss: number,
  nextNetLoss: number,
): { daily: number; weekly: number; monthly: number } {
  const before = RakebackRates.calculateFromLoss(userLevel, prevNetLoss);
  const after = RakebackRates.calculateFromLoss(userLevel, nextNetLoss);
  return {
    daily: round2(after.daily - before.daily),
    weekly: round2(after.weekly - before.weekly),
    monthly: round2(after.monthly - before.monthly),
  };
}

/**
 * Limits how much **positive** rakeback can be added today (UTC). Negative deltas (net win) pass through.
 * Returns adjusted deltas and the sum of positive components after scaling (for day counter).
 */
export function applyDailyPositiveAccrualCap(
  delta: { daily: number; weekly: number; monthly: number },
  dayTotalSoFar: number,
  maxDaily: number = RAKEBACK_ANTI_ABUSE.MAX_DAILY_RAKEBACK,
): {
  daily: number;
  weekly: number;
  monthly: number;
  appliedPositiveSum: number;
} {
  const pos = (x: number) => Math.max(0, round2(x));
  const posDaily = pos(delta.daily);
  const posWeekly = pos(delta.weekly);
  const posMonthly = pos(delta.monthly);
  const posSum = round2(posDaily + posWeekly + posMonthly);
  const remaining = Math.max(
    0,
    round2(maxDaily - Math.max(0, round2(dayTotalSoFar))),
  );

  if (posSum <= 0 || posSum <= remaining) {
    return {
      daily: delta.daily,
      weekly: delta.weekly,
      monthly: delta.monthly,
      appliedPositiveSum: posSum,
    };
  }

  const factor = remaining / posSum;
  return {
    daily: delta.daily < 0 ? delta.daily : round2(delta.daily * factor),
    weekly: delta.weekly < 0 ? delta.weekly : round2(delta.weekly * factor),
    monthly: delta.monthly < 0 ? delta.monthly : round2(delta.monthly * factor),
    appliedPositiveSum: remaining,
  };
}
