/** Slugs must match `reward_case_definitions.slug` (seeded in migration). */
export const REWARD_LEVEL_CASE_SLUGS: readonly string[] = [
  'reward-iron',
  'reward-bronze',
  'reward-silver',
  'reward-gold',
  'reward-amethyst',
  'reward-sapphire',
  'reward-emerald',
  'reward-topaz',
  'reward-spinel',
  'reward-alexandrite',
];

export const REWARD_RAKEBACK_CASE_SLUG = 'wager-rakeback';

export const REWARD_KEYS_PER_LEVEL_UP = 1;

/** When a user reaches this level, they receive this many rakeback-case keys. */
export const RAKEBACK_MILESTONE_KEYS: Readonly<Record<number, number>> = {
  10: 2,
  25: 3,
  50: 5,
  75: 8,
  100: 12,
};

/** Maps account level to the tier case that receives level-up keys (L0–9 → iron, L10–19 → bronze, …). */
export function rewardCaseSlugForLevel(level: number): string {
  const idx = Math.min(
    REWARD_LEVEL_CASE_SLUGS.length - 1,
    Math.max(0, Math.floor(level / 10)),
  );
  return REWARD_LEVEL_CASE_SLUGS[idx];
}
