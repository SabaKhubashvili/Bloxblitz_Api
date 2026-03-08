import { Tier } from '../enums/tier.enum';

interface TierEntry {
  readonly min: number;
  readonly name: string;
  readonly tier: Tier;
}

/**
 * Ordered from highest to lowest so the first match wins.
 * Mirrors the front-end LevelToLevelName constant exactly.
 */
const TIER_MAP: ReadonlyArray<TierEntry> = [
  { min: 90, name: 'Alexandrite', tier: Tier.ALEXANDRITE },
  { min: 80, name: 'Spinel',      tier: Tier.SPINEL      },
  { min: 70, name: 'Topaz',       tier: Tier.TOPAZ       },
  { min: 60, name: 'Emerald',     tier: Tier.EMERALD     },
  { min: 50, name: 'Sapphire',    tier: Tier.SAPPHIRE    },
  { min: 40, name: 'Amethyst',    tier: Tier.AMETHYST    },
  { min: 30, name: 'Gold',        tier: Tier.GOLD        },
  { min: 20, name: 'Silver',      tier: Tier.SILVER      },
  { min: 10, name: 'Bronze',      tier: Tier.BRONZE      },
  { min:  0, name: 'Iron',        tier: Tier.IRON        },
];

export function resolveLevelName(level: number): string {
  return TIER_MAP.find((entry) => level >= entry.min)?.name ?? 'Iron';
}

export function resolveTier(level: number): Tier {
  return TIER_MAP.find((entry) => level >= entry.min)?.tier ?? Tier.IRON;
}

/**
 * Tier number = floor(level / 10) + 1, clamped to [1, 10].
 * Examples: level 0–9 → 1, level 10–19 → 2, level 90–100 → 10.
 */
export function resolveTierNumber(level: number): number {
  return Math.min(Math.floor(level / 10) + 1, 10);
}
