import { TowersDifficulty } from './towers.enums';

export interface TowersRowConfig {
  tiles: number;
  gems: number;
}

export const TOWERS_DIFFICULTY_CONFIG: Record<TowersDifficulty, TowersRowConfig[]> = {
  [TowersDifficulty.EASY]: [{ tiles: 3, gems: 2 }],
  [TowersDifficulty.MEDIUM]: [
    { tiles: 2, gems: 1 },
    { tiles: 3, gems: 2 },
    { tiles: 2, gems: 1 },
  ],
  /** Every row: 3 tiles, exactly 1 gem (2 bombs). */
  [TowersDifficulty.HARD]: [{ tiles: 3, gems: 1 }],
};

export const TOWERS_ALLOWED_LEVELS = [8, 10, 12, 16] as const;
export type TowersAllowedLevels = (typeof TOWERS_ALLOWED_LEVELS)[number];

export function towersGenerateRows(
  difficulty: TowersDifficulty,
  levels: number,
): TowersRowConfig[] {
  const pattern = TOWERS_DIFFICULTY_CONFIG[difficulty];
  const rows: TowersRowConfig[] = [];
  for (let i = 0; i < levels; i++) {
    rows.push(pattern[i % pattern.length]!);
  }
  return rows;
}

export function isTowersDifficulty(v: unknown): v is TowersDifficulty {
  return (
    v === TowersDifficulty.EASY ||
    v === TowersDifficulty.MEDIUM ||
    v === TowersDifficulty.HARD
  );
}

export function isTowersAllowedLevels(v: unknown): v is TowersAllowedLevels {
  return (
    typeof v === 'number' &&
    (TOWERS_ALLOWED_LEVELS as readonly number[]).includes(v)
  );
}
