/**
 * XP Rates — coins wagered → XP earned per game type
 *
 * ── Calibration target ────────────────────────────────────────────────────────
 *   A player who wagers $1 000 (~2 400 coins at $1 = 2.4 coins) playing Mines
 *   should realistically reach at least level 40.
 *
 *   XP formula (domain service):  xpRequired(n) = 100n + 10n²
 *   XP needed for level 40      = 100×40 + 10×40² = 20 000 XP
 *   Minimum rate to hit level 40 = 20 000 / 2 400 ≈ 8.33 XP/coin
 *   → Mines rate set to 10 → 24 000 XP → level 44  (comfortable margin)
 *
 * ── Design principles ─────────────────────────────────────────────────────────
 *   • XP is awarded on the WAGERED amount (bet size), not on profit.
 *     This rewards engagement regardless of outcome — identical to how
 *     rakeback / comp-point systems work industry-wide.
 *   • Rates scale with skill/risk profile:
 *       Higher active decision count per session = higher rate.
 *
 * ── Level projections at $1 000 wagered (2 400 coins) ────────────────────────
 * ┌─────────────┬──────────┬──────────────┬────────────────────────────────────┐
 * │ Game        │ XP/coin  │ XP earned    │ Level reached                      │
 * ├─────────────┼──────────┼──────────────┼────────────────────────────────────┤
 * │ JACKPOT     │    3     │   7 200 XP   │ ~22  (passive entry; lowest skill) │
 * │ COINFLIP    │    5     │  12 000 XP   │ ~30  (pure luck; fastest rounds)   │
 * │ CRASH       │    7.5   │  18 000 XP   │ ~37  (timing skill; medium risk)   │
 * │ MINES       │   10     │  24 000 XP   │ ~44  (most decisions; high risk) ✓ │
 * └─────────────┴──────────┴──────────────┴────────────────────────────────────┘
 */

export interface GameXpRate {
  /** XP earned per 1 unit of coins wagered. */
  readonly xpPerCoin: number;
  /** Why this rate was chosen — kept in code so decisions are self-documenting. */
  readonly rationale: string;
}

export const GAME_XP_RATES = {
  JACKPOT: {
    xpPerCoin: 3,
    rationale:
      'Passive deposit-and-wait format with no in-round decisions; lowest engagement per session',
  },
  COINFLIP: {
    xpPerCoin: 5,
    rationale:
      'Purely luck-based 50/50; fastest round cycle — low rate prevents mindless XP farming',
  },
  CRASH: {
    xpPerCoin: 7.5,
    rationale:
      'Moderate skill (cashout timing) with medium-length sessions; mid-tier rate',
  },
  MINES: {
    xpPerCoin: 10,
    rationale:
      'Most active game: every tile reveal is an independent risk/reward decision. ' +
      'Calibrated so $1 000 wagered (~2 400 coins) yields ~24 000 XP → level 44, ' +
      'comfortably above the level-40 target. Highest rate reflects highest engagement.',
  },
} as const satisfies Record<string, GameXpRate>;

/** Convenience accessor — avoids magic strings at call sites. */
export const MINES_XP_RATE  = GAME_XP_RATES.MINES.xpPerCoin;
export const CRASH_XP_RATE  = GAME_XP_RATES.CRASH.xpPerCoin;
export const COINFLIP_XP_RATE = GAME_XP_RATES.COINFLIP.xpPerCoin;
export const JACKPOT_XP_RATE  = GAME_XP_RATES.JACKPOT.xpPerCoin;
