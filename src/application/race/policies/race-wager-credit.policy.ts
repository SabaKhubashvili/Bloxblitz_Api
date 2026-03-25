/**
 * Maps real money staked (`gross`) into race leaderboard credit.
 * Tiny stakes contribute sub-linearly; below `MIN_GROSS` nothing is credited.
 */
const MIN_GROSS = 0.05;
const SUBLINEAR_REF = 2;

export function computeGrossRaceCredit(gross: number): number {
  const g = Math.round(gross * 100) / 100;
  if (g < MIN_GROSS) return 0;
  const scale = Math.min(1, Math.sqrt(g / SUBLINEAR_REF));
  return Math.round(g * scale * 100) / 100;
}

export function applyMultipliers(base: number, ...factors: number[]): number {
  let x = base;
  for (const f of factors) {
    if (Number.isFinite(f) && f > 0) x *= f;
  }
  return Math.round(x * 100) / 100;
}
