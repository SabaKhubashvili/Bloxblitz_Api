import { TowersDifficulty } from './towers.enums';
import {
  TOWERS_ALLOWED_LEVELS,
  towersGenerateRows,
  type TowersRowConfig,
} from './towers.config';

const RTP_MIN = 0.92;
const RTP_MAX = 0.98;

/** 2-decimal rounding; tiny nudge avoids 10.934999… float artifacts. */
function round2(n: number): number {
  return Math.round((n + 1e-9) * 100) / 100;
}

function parseRtpTarget(): number {
  const raw = process.env.TOWERS_RTP_TARGET;
  if (raw === undefined || raw === '') {
    return 0.96;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0.96;
  }
  return Math.min(RTP_MAX, Math.max(RTP_MIN, n));
}

/**
 * Target RTP for Towers: expected return on a "play through" path scales with the
 * ladder so P(full clear) × maxMultiplier = RTP (Easy: (2/3)^n × RTP × (3/2)^n).
 *
 * Configurable via `TOWERS_RTP_TARGET` env (decimal 0.92–0.98); default 0.96.
 */
export const TOWERS_RTP_TARGET = parseRtpTarget();

/** Convenience: house share 1 − RTP (for ops / telemetry). */
export const TOWERS_HOUSE_EDGE = 1 - TOWERS_RTP_TARGET;

/**
 * Fair inverse probability product after clearing rows 0..k inclusive
 * (geometric ladder): Π (tiles/gems) per row = 1 / P(clear those rows blind).
 */
export function computeTowersMultiplierLadder(
  rows: TowersRowConfig[],
  rtp: number,
): number[] {
  const r = Math.min(RTP_MAX, Math.max(RTP_MIN, rtp));
  let fairProduct = 1;
  const ladder: number[] = [];
  for (const row of rows) {
    const { tiles, gems } = row;
    if (gems <= 0 || tiles < gems) {
      ladder.push(round2(r * fairProduct));
      continue;
    }
    const p = gems / tiles;
    fairProduct *= 1 / p;
    ladder.push(round2(r * fairProduct));
  }
  return ladder;
}

export class TowersMultiplierService {
  static buildLadder(
    _difficulty: TowersDifficulty,
    rows: TowersRowConfig[],
  ): number[] {
    return computeTowersMultiplierLadder(rows, TOWERS_RTP_TARGET);
  }

  /** Ladders for lobby / API preview: every allowed level count × all difficulties. */
  static buildPreviewLadders(): Record<
    (typeof TOWERS_ALLOWED_LEVELS)[number],
    Record<TowersDifficulty, number[]>
  > {
    const out = {} as Record<
      (typeof TOWERS_ALLOWED_LEVELS)[number],
      Record<TowersDifficulty, number[]>
    >;
    for (const levels of TOWERS_ALLOWED_LEVELS) {
      out[levels] = {
        [TowersDifficulty.EASY]: this.buildLadder(
          TowersDifficulty.EASY,
          towersGenerateRows(TowersDifficulty.EASY, levels),
        ),
        [TowersDifficulty.MEDIUM]: this.buildLadder(
          TowersDifficulty.MEDIUM,
          towersGenerateRows(TowersDifficulty.MEDIUM, levels),
        ),
        [TowersDifficulty.HARD]: this.buildLadder(
          TowersDifficulty.HARD,
          towersGenerateRows(TowersDifficulty.HARD, levels),
        ),
      };
    }
    return out;
  }
}

export type TowersMultiplierLaddersPreview = ReturnType<
  typeof TowersMultiplierService.buildPreviewLadders
>;

/** Cached preview for active-game and start responses (deterministic, cheap). */
export const TOWERS_MULTIPLIER_LADDERS_PREVIEW =
  TowersMultiplierService.buildPreviewLadders();
