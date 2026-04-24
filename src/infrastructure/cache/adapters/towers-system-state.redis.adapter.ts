import { Injectable, Logger } from '@nestjs/common';
import type { TowersSystemStateProvider } from '../../../domain/game/towers/ports/towers-system-state.provider.port';
import { TowersSystemMode } from '../../../domain/game/towers/ports/towers-system-state.provider.port';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';

const DEFAULT_MODE = TowersSystemMode.ACTIVE;

const MODE_CACHE_MS = 200;

function parseMode(raw: unknown): TowersSystemMode | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return null;
  const mode = (raw as Record<string, unknown>).mode;
  if (mode === TowersSystemMode.ACTIVE) return TowersSystemMode.ACTIVE;
  if (mode === TowersSystemMode.NEW_GAMES_DISABLED)
    return TowersSystemMode.NEW_GAMES_DISABLED;
  if (mode === TowersSystemMode.PAUSED) return TowersSystemMode.PAUSED;
  return null;
}

@Injectable()
export class TowersSystemStateRedisAdapter implements TowersSystemStateProvider {
  private readonly log = new Logger(TowersSystemStateRedisAdapter.name);
  private readonly key = RedisKeys.towers.systemState();
  private cache: { mode: TowersSystemMode; at: number } | null = null;

  constructor(private readonly redis: RedisService) {}

  async isPaused(): Promise<boolean> {
    const mode = await this.getModeCached();
    return mode === TowersSystemMode.PAUSED;
  }

  async isNewGamesDisabled(): Promise<boolean> {
    const mode = await this.getModeCached();
    return (
      mode === TowersSystemMode.NEW_GAMES_DISABLED ||
      mode === TowersSystemMode.PAUSED
    );
  }

  private async getModeCached(): Promise<TowersSystemMode> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < MODE_CACHE_MS) {
      return this.cache.mode;
    }
    const mode = await this.readModeFromRedis();
    this.cache = { mode, at: now };
    return mode;
  }

  private async readModeFromRedis(): Promise<TowersSystemMode> {
    try {
      const raw = await this.redis.get<string>(this.key);
      if (raw == null || raw === '') return DEFAULT_MODE;
      const parsed =
        typeof raw === 'string'
          ? (JSON.parse(raw) as unknown)
          : (raw as unknown);
      const mode = parseMode(parsed);
      return mode ?? DEFAULT_MODE;
    } catch (e) {
      this.log.warn(
        `[towers.system_state.read_failed] key=${this.key} err=${
          e instanceof Error ? e.message : e
        } — defaulting ACTIVE`,
      );
      return DEFAULT_MODE;
    }
  }
}
