import {
  accrualDeltaForNetLossChange,
  applyDailyPositiveAccrualCap,
  clampEligibleIncrement,
  isEligibleRakebackWager,
  netLossFromEligible,
  round2,
} from './rakeback-loss-accrual.policy';
import { RAKEBACK_ANTI_ABUSE } from '../config/rakeback-anti-abuse.config';

describe('rakeback-loss-accrual.policy', () => {
  describe('isEligibleRakebackWager', () => {
    it('rejects below MIN_RAKEBACK_BET', () => {
      expect(isEligibleRakebackWager(0.5)).toBe(false);
      expect(isEligibleRakebackWager(0.99)).toBe(false);
    });

    it('accepts at threshold', () => {
      expect(
        isEligibleRakebackWager(RAKEBACK_ANTI_ABUSE.MIN_RAKEBACK_BET),
      ).toBe(true);
    });
  });

  describe('netLossFromEligible', () => {
    it('is zero when user is ahead', () => {
      expect(netLossFromEligible(100, 150)).toBe(0);
    });

    it('is wager minus won when losing', () => {
      expect(netLossFromEligible(100, 30)).toBe(70);
    });
  });

  describe('applyDailyPositiveAccrualCap', () => {
    it('scales positive deltas when over remaining allowance', () => {
      const out = applyDailyPositiveAccrualCap(
        { daily: 200, weekly: 200, monthly: 200 },
        0,
        300,
      );
      expect(out.appliedPositiveSum).toBe(300);
      expect(out.daily).toBeCloseTo(100, 5);
      expect(out.weekly).toBeCloseTo(100, 5);
      expect(out.monthly).toBeCloseTo(100, 5);
    });

    it('does not scale negative deltas', () => {
      const out = applyDailyPositiveAccrualCap(
        { daily: -50, weekly: 10, monthly: 0 },
        0,
        5,
      );
      expect(out.daily).toBe(-50);
      expect(out.weekly).toBeLessThanOrEqual(5);
    });
  });

  describe('accrualDeltaForNetLossChange', () => {
    it('returns zero delta when net loss unchanged', () => {
      const d = accrualDeltaForNetLossChange(5, 100, 100);
      expect(d.daily).toBe(0);
      expect(d.weekly).toBe(0);
      expect(d.monthly).toBe(0);
    });
  });

  describe('clampEligibleIncrement', () => {
    it('caps huge values', () => {
      expect(clampEligibleIncrement(1e12)).toBe(
        RAKEBACK_ANTI_ABUSE.MAX_ELIGIBLE_INCREMENT,
      );
    });
  });

  describe('round2', () => {
    it('stabilizes floats', () => {
      expect(round2(1.234)).toBe(1.23);
      expect(round2(1.236)).toBe(1.24);
    });
  });
});
