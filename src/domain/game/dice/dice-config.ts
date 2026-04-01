/**
 * Dice runtime config — keep aligned with
 * BloxBlitz_Admin/admin-api/src/dice-analytics/domain/dice-config.* (Redis hash `dice:config`).
 *
 * `minChance` / `maxChance` are gameplay bounds (not yet in admin hash); missing hash fields fall back here.
 */
export const DICE_CONFIG_REDIS_KEY = 'dice:config';

export type DiceConfig = {
  minBet: number;
  maxBet: number;
  /** House edge percent (same Redis field as admin: `houseEdge`). */
  houseEdge: number;
  rtpTarget: number;
  maxPayoutMultiplier: number;
  minChance: number;
  maxChance: number;
};

export const DEFAULT_DICE_CONFIG: DiceConfig = {
  minBet: 0.1,
  maxBet: 3000,
  houseEdge: 1.5,
  rtpTarget: 97,
  maxPayoutMultiplier: 1000,
  minChance: 2,
  maxChance: 98,
};

export function cloneDiceConfig(c: DiceConfig): DiceConfig {
  return { ...c };
}

export function diceConfigFromRedisHash(
  hash: Record<string, string>,
  defaults: DiceConfig,
): DiceConfig {
  const pick = (key: keyof DiceConfig): number => {
    const raw = hash[key as string];
    if (raw === undefined || raw === '') return defaults[key];
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaults[key];
  };
  return {
    minBet: pick('minBet'),
    maxBet: pick('maxBet'),
    houseEdge: pick('houseEdge'),
    rtpTarget: pick('rtpTarget'),
    maxPayoutMultiplier: pick('maxPayoutMultiplier'),
    minChance: pick('minChance'),
    maxChance: pick('maxChance'),
  };
}

/**
 * Full snapshot validation after Redis merge / defaults.
 */
export function validateDiceConfig(c: DiceConfig): boolean {
  const nums = [
    c.minBet,
    c.maxBet,
    c.houseEdge,
    c.rtpTarget,
    c.maxPayoutMultiplier,
    c.minChance,
    c.maxChance,
  ];
  if (!nums.every(Number.isFinite)) return false;
  if (c.minBet < 0) return false;
  if (c.maxBet <= c.minBet) return false;
  if (c.houseEdge <= 0 || c.houseEdge >= 100) return false;
  if (c.rtpTarget < 0 || c.rtpTarget > 100) return false;
  if (c.maxPayoutMultiplier <= 0) return false;
  if (c.minChance <= 0 || c.maxChance >= 100) return false;
  if (c.minChance >= c.maxChance) return false;
  return true;
}
