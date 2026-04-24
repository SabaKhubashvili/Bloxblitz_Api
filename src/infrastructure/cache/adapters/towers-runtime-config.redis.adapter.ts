import { Injectable, Logger } from '@nestjs/common';
import { TOWERS_ALLOWED_LEVELS } from '../../../domain/game/towers/towers.config';
import { TowersDifficulty } from '../../../domain/game/towers/towers.enums';
import type {
  TowersRuntimeConfig,
  TowersRuntimeConfigProvider,
} from '../../../domain/game/towers/ports/towers-runtime-config.provider.port';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';

const DEFAULT_CONFIG: TowersRuntimeConfig = {
  minBet: 0.01,
  maxBet: 3000,
  allowedDifficulties: [
    TowersDifficulty.EASY,
    TowersDifficulty.MEDIUM,
    TowersDifficulty.HARD,
  ],
  allowedLevels: [...TOWERS_ALLOWED_LEVELS],
};

const CACHE_MS = 200;

function isPosNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function parseConfig(raw: unknown): TowersRuntimeConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return null;
  const o = raw as Record<string, unknown>;
  if (!isPosNum(o.minBet) || !isPosNum(o.maxBet)) return null;
  if (o.minBet > o.maxBet) return null;
  if (
    !Array.isArray(o.allowedDifficulties) ||
    o.allowedDifficulties.length === 0
  ) {
    return null;
  }
  const allowed = new Set(Object.values(TowersDifficulty));
  const diffs = o.allowedDifficulties.filter(
    (d): d is string =>
      typeof d === 'string' && allowed.has(d as TowersDifficulty),
  );
  if (diffs.length === 0) return null;
  if (!Array.isArray(o.allowedLevels) || o.allowedLevels.length === 0)
    return null;
  const allowedLevelSet = new Set(TOWERS_ALLOWED_LEVELS as readonly number[]);
  const levels = o.allowedLevels
    .filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    .filter((x) => allowedLevelSet.has(x));
  if (levels.length === 0) return null;
  return {
    minBet: o.minBet,
    maxBet: o.maxBet,
    allowedDifficulties: [...new Set(diffs)],
    allowedLevels: [...new Set(levels)].sort((a, b) => a - b),
  };
}

@Injectable()
export class TowersRuntimeConfigRedisAdapter implements TowersRuntimeConfigProvider {
  private readonly log = new Logger(TowersRuntimeConfigRedisAdapter.name);
  private readonly key = RedisKeys.towers.adminConfig();
  private cache: { cfg: TowersRuntimeConfig; at: number } | null = null;

  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<TowersRuntimeConfig> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) {
      return this.cache.cfg;
    }
    const cfg = await this.readFromRedis();
    this.cache = { cfg, at: now };
    return cfg;
  }

  private async readFromRedis(): Promise<TowersRuntimeConfig> {
    try {
      const raw = await this.redis.get<string>(this.key);
      if (raw == null || raw === '') return { ...DEFAULT_CONFIG };
      const parsed =
        typeof raw === 'string'
          ? (JSON.parse(raw) as unknown)
          : (raw as unknown);
      const c = parseConfig(parsed);
      if (c) return c;
      this.log.warn(
        `[towers.admin_config.invalid] key=${this.key} — using defaults`,
      );
      return { ...DEFAULT_CONFIG };
    } catch (e) {
      this.log.warn(
        `[towers.admin_config.read_failed] key=${this.key} err=${
          e instanceof Error ? e.message : e
        }`,
      );
      return { ...DEFAULT_CONFIG };
    }
  }
}
