import { Injectable, Logger } from '@nestjs/common';
import type {
  RouletteAdminWagerGateProvider,
  RouletteAdminWagerGateState,
} from '../../../domain/game/towers/ports/roulette-admin-wager-gate.provider.port';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';

const CACHE_MS = 200;

/** Match BloxBlitz_Amp/ws `roulette-redis.service` hash field parsing. */
function parseHashEnabled(raw: string | undefined): boolean {
  if (raw === null || raw === undefined) {
    return true;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') {
    return false;
  }
  return true;
}

@Injectable()
export class RouletteAdminWagerGateRedisAdapter implements RouletteAdminWagerGateProvider {
  private readonly log = new Logger(RouletteAdminWagerGateRedisAdapter.name);
  private readonly key = RedisKeys.roulette.adminConfigHash();
  private cache: { state: RouletteAdminWagerGateState; at: number } | null =
    null;

  constructor(private readonly redis: RedisService) {}

  async getWagerGateState(): Promise<RouletteAdminWagerGateState> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) {
      return this.cache.state;
    }

    try {
      const all = await this.redis.hgetall(this.key);
      const state: RouletteAdminWagerGateState = {
        gameEnabled: parseHashEnabled(all.gameEnabled),
        bettingEnabled: parseHashEnabled(all.bettingEnabled),
      };
      this.cache = { state, at: now };
      return state;
    } catch (e) {
      this.log.warn(
        `[roulette.admin_wager_gate.read_failed] key=${this.key} err=${
          e instanceof Error ? e.message : e
        } — defaulting both enabled`,
      );
      const fallback: RouletteAdminWagerGateState = {
        gameEnabled: true,
        bettingEnabled: true,
      };
      this.cache = { state: fallback, at: now };
      return fallback;
    }
  }
}
