import { LEVELING_CONFIG } from '../../domain/leveling/config/leveling.config';

/**
 * XP Rates — coins wagered → XP earned per game type
 *
 * Rates are scaled proportionally with leveling XP progression (Level 0→1 = 5000 XP).
 * Base rates × GAME_RATE_SCALE_FACTOR preserve relative progression across games.
 *
 * ── Design principles ─────────────────────────────────────────────────────────
 *   • XP is awarded on the WAGERED amount (bet size), not on profit.
 *     This rewards engagement regardless of outcome — identical to how
 *     rakeback / comp-point systems work industry-wide.
 *   • Rates scale with skill/risk profile:
 *       Higher active decision count per session = higher rate.
 *
 * ── Base rates (pre-scale) / Scaled rates ─────────────────────────────────────
 *   JACKPOT:  3  → ~136  (passive entry; lowest skill)
 *   COINFLIP: 5  → ~227  (pure luck; fastest rounds)
 *   CRASH:    7.5→ ~341  (timing skill; medium risk)
 *   MINES:   10  → ~455  (most decisions; high risk)
 */

const SCALE = LEVELING_CONFIG.GAME_RATE_SCALE_FACTOR;

export interface GameXpRate {
  /** XP earned per 1 unit of coins wagered. */
  readonly xpPerCoin: number;
  /** Why this rate was chosen — kept in code so decisions are self-documenting. */
  readonly rationale: string;
}

export const GAME_XP_RATES = {
  JACKPOT: {
    xpPerCoin: Math.round(3 * SCALE),
    rationale:
      'Passive deposit-and-wait format with no in-round decisions; lowest engagement per session',
  },
  COINFLIP: {
    xpPerCoin: Math.round(5 * SCALE),
    rationale:
      'Purely luck-based 50/50; fastest round cycle — low rate prevents mindless XP farming',
  },
  CRASH: {
    xpPerCoin: Math.round(7.5 * SCALE),
    rationale:
      'Moderate skill (cashout timing) with medium-length sessions; mid-tier rate',
  },
  MINES: {
    xpPerCoin: Math.round(10 * SCALE),
    rationale:
      'Most active game: every tile reveal is an independent risk/reward decision. ' +
      'Highest rate reflects highest engagement. Scaled with leveling progression.',
  },
  DICE: {
    xpPerCoin: Math.round(6 * SCALE),
    rationale:
      'Instant roll-based game; similar engagement to coinflip with single decision per round.',
  },
} as const satisfies Record<string, GameXpRate>;

/** Convenience accessor — avoids magic strings at call sites. */
export const MINES_XP_RATE  = GAME_XP_RATES.MINES.xpPerCoin;
export const DICE_XP_RATE   = GAME_XP_RATES.DICE.xpPerCoin;
export const CRASH_XP_RATE  = GAME_XP_RATES.CRASH.xpPerCoin;
export const COINFLIP_XP_RATE = GAME_XP_RATES.COINFLIP.xpPerCoin;
export const JACKPOT_XP_RATE  = GAME_XP_RATES.JACKPOT.xpPerCoin;
