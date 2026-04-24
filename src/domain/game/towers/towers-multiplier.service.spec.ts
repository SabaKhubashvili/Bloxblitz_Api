import { TowersDifficulty } from './towers.enums';
import { towersGenerateRows } from './towers.config';
import { computeTowersMultiplierLadder } from './towers-multiplier.service';

describe('TowersMultiplierService ladder math', () => {
  const rtp = 0.96;

  it('Easy × 8: geometric ladder matches RTP × (3/2)^k per level', () => {
    const rows = towersGenerateRows(TowersDifficulty.EASY, 8);
    const ladder = computeTowersMultiplierLadder(rows, rtp);
    expect(ladder).toHaveLength(8);
    const expected = [1.44, 2.16, 3.24, 4.86, 7.29, 10.94, 16.4, 24.6].map(
      (x) => Math.round(x * 100) / 100,
    );
    expect(ladder).toEqual(expected);
  });

  it('Easy × 8: full clear probability × max multiplier ≈ RTP (return on stake)', () => {
    const rows = towersGenerateRows(TowersDifficulty.EASY, 8);
    const ladder = computeTowersMultiplierLadder(rows, rtp);
    const pClear = (2 / 3) ** 8;
    expect(pClear * ladder[7]).toBeCloseTo(0.96, 2);
  });

  it('fair reference max for Easy × 8 is (3/2)^8; capped payout is RTP × fair', () => {
    const fairMax = (3 / 2) ** 8;
    expect(fairMax).toBeCloseTo(25.62890625, 5);
    const rows = towersGenerateRows(TowersDifficulty.EASY, 8);
    const ladder = computeTowersMultiplierLadder(rows, rtp);
    expect(ladder[7]).toBeCloseTo(rtp * fairMax, 2);
  });

  it('multipliers are strictly increasing for standard row configs', () => {
    for (const levels of [8, 10, 12, 16] as const) {
      for (const difficulty of Object.values(TowersDifficulty)) {
        const rows = towersGenerateRows(difficulty, levels);
        const ladder = computeTowersMultiplierLadder(rows, rtp);
        for (let i = 1; i < ladder.length; i++) {
          expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
        }
      }
    }
  });
});
