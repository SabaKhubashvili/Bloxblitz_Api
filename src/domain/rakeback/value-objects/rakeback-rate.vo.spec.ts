import { RakebackRates } from './rakeback-rate.vo';

describe('RakebackRates.calculateFromLoss', () => {
  it('returns zero pools for zero net loss', () => {
    const r = RakebackRates.calculateFromLoss(10, 0);
    expect(r.daily).toBe(0);
    expect(r.weekly).toBe(0);
    expect(r.monthly).toBe(0);
    expect(r.total).toBe(0);
  });

  it('matches wager formula when netLoss equals a wager base', () => {
    const level = 15;
    const netLoss = 1000;
    const fromLoss = RakebackRates.calculateFromLoss(level, netLoss);
    const rates = RakebackRates.forLevel(level);
    expect(fromLoss.daily).toBe(Math.round(netLoss * rates.daily * 100) / 100);
    expect(fromLoss.total).toBe(
      Math.round((fromLoss.daily + fromLoss.weekly + fromLoss.monthly) * 100) /
        100,
    );
  });

  it('ignores negative net loss input', () => {
    const r = RakebackRates.calculateFromLoss(20, -50);
    expect(r.total).toBe(0);
  });
});
