import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import type { IMinesConfigPort } from '../../../application/game/mines/ports/mines-config.port';
import {
  MINES_CONFIG_DEFAULTS,
  MINES_CONFIG_REDIS_KEY,
  type MinesConfigPayload,
} from '../../../domain/game/mines/mines-config';

/** Last good read — mirrors admin MinesConfigRedisService resilience when Redis is down or key invalid. */
let minesConfigMemory: MinesConfigPayload | null = null;

@Injectable()
export class MinesConfigRedisAdapter implements IMinesConfigPort {
  private readonly log = new Logger(MinesConfigRedisAdapter.name);
  private readonly key = MINES_CONFIG_REDIS_KEY;

  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<MinesConfigPayload> {
    try {
      const raw = await this.redis.get<unknown>(this.key);
      const parsed = this.normalizeStored(raw);
      if (parsed) {
        minesConfigMemory = { ...parsed };
        return { ...parsed };
      }
    } catch (e) {
      this.log.warn(
        `mines config Redis read failed: ${e instanceof Error ? e.message : e}`,
      );
    }

    if (minesConfigMemory) {
      return { ...minesConfigMemory };
    }

    return { ...MINES_CONFIG_DEFAULTS };
  }

  private normalizeStored(raw: unknown): MinesConfigPayload | null {
    if (raw === null || raw === undefined) return null;

    let o: unknown = raw;
    if (typeof raw === 'string') {
      try {
        o = JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }

    if (!o || typeof o !== 'object') return null;
    const p = o as Record<string, unknown>;
    const minBet = Number(p.minBet);
    const maxBet = Number(p.maxBet);
    const houseEdge = Number(p.houseEdge);
    const rtpTarget = Number(p.rtpTarget);

    if (![minBet, maxBet, houseEdge, rtpTarget].every(Number.isFinite)) {
      return null;
    }
    if (minBet < 0 || maxBet <= minBet) return null;
    if (houseEdge < 0 || houseEdge > 100 || rtpTarget < 0 || rtpTarget > 100) {
      return null;
    }

    return { minBet, maxBet, houseEdge, rtpTarget };
  }
}
