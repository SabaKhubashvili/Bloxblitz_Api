import { Injectable, Logger } from '@nestjs/common';
import type { MinesSystemStateProvider } from '../../../domain/game/mines/ports/mines-system-state.provider.port';
import { MinesSystemMode } from '../../../domain/game/mines/ports/mines-system-state.provider.port';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';

const DEFAULT_MODE = MinesSystemMode.ACTIVE;

/** Short TTL so bursts share one Redis read without lagging admin toggles. */
const MODE_CACHE_MS = 200;

function parseMode(raw: unknown): MinesSystemMode | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return null;
  const mode = (raw as Record<string, unknown>).mode;
  if (mode === MinesSystemMode.ACTIVE) return MinesSystemMode.ACTIVE;
  if (mode === MinesSystemMode.NEW_GAMES_DISABLED)
    return MinesSystemMode.NEW_GAMES_DISABLED;
  if (mode === MinesSystemMode.PAUSED) return MinesSystemMode.PAUSED;
  return null;
}

@Injectable()
export class MinesSystemStateRedisAdapter implements MinesSystemStateProvider {
  private readonly log = new Logger(MinesSystemStateRedisAdapter.name);
  private readonly key = RedisKeys.mines.systemState();
  private cache: { mode: MinesSystemMode; at: number } | null = null;

  constructor(private readonly redis: RedisService) {}

  async isPaused(): Promise<boolean> {
    const mode = await this.getModeCached();
    return mode === MinesSystemMode.PAUSED;
  }

  async isNewGamesDisabled(): Promise<boolean> {
    const mode = await this.getModeCached();
    return (
      mode === MinesSystemMode.NEW_GAMES_DISABLED ||
      mode === MinesSystemMode.PAUSED
    );
  }

  private async getModeCached(): Promise<MinesSystemMode> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < MODE_CACHE_MS) {
      return this.cache.mode;
    }
    const mode = await this.readModeFromRedis();
    this.cache = { mode, at: now };
    return mode;
  }

  private async readModeFromRedis(): Promise<MinesSystemMode> {
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
        `[mines.system_state.read_failed] key=${this.key} err=${
          e instanceof Error ? e.message : e
        } — defaulting ACTIVE`,
      );
      return DEFAULT_MODE;
    }
  }
}
