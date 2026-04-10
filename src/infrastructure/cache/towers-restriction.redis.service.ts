import { Injectable, Logger } from '@nestjs/common';
import { RedisKeys } from './redis.keys';
import { RedisService } from './redis.service';
import type { TowersPlayerRestrictionSnapshot } from '../../domain/game/towers/towers-player-restriction.snapshot';
import type { TowersWagerWindow } from '../../domain/game/towers/towers-wager-window';
import { towersWagerWindowTtlSeconds } from '../../domain/game/towers/towers-wager-window';

const ADD_WAGER_LUA = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local maxTotal = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
if amount == nil or maxTotal == nil or ttl == nil then
  return 'ERR:0'
end
local cur = tonumber(redis.call('GET', key) or '0')
if cur + amount > maxTotal + 0.0001 then
  return 'ERR:' .. tostring(cur)
end
if redis.call('EXISTS', key) == 0 then
  redis.call('SET', key, tostring(amount), 'EX', ttl)
else
  redis.call('INCRBYFLOAT', key, amount)
end
return 'OK:' .. redis.call('GET', key)
`;

@Injectable()
export class TowersRestrictionRedisService {
  private readonly log = new Logger(TowersRestrictionRedisService.name);

  constructor(private readonly redis: RedisService) {}

  private norm(u: string): string {
    return u.trim().toLowerCase();
  }

  /**
   * Redis-only restriction profile for Towers (written by admin-api). Never reads Prisma.
   */
  async getRestriction(
    username: string,
  ): Promise<TowersPlayerRestrictionSnapshot | null> {
    const u = this.norm(username);
    try {
      const hash = RedisKeys.towers.restrictionsHash();
      const field = RedisKeys.towers.restrictionField(u);
      const raw = await this.redis.hget(hash, field);
      if (raw == null || raw === '') return null;
      const o = JSON.parse(raw) as Record<string, unknown>;
      return {
        username: u,
        banned: Boolean(o.banned),
        banReason:
          typeof o.banReason === 'string'
            ? o.banReason
            : o.banReason === null
              ? null
              : null,
        dailyWagerLimit:
          typeof o.dailyWagerLimit === 'number' ? o.dailyWagerLimit : null,
        weeklyWagerLimit:
          typeof o.weeklyWagerLimit === 'number' ? o.weeklyWagerLimit : null,
        monthlyWagerLimit:
          typeof o.monthlyWagerLimit === 'number' ? o.monthlyWagerLimit : null,
        limitReason:
          typeof o.limitReason === 'string'
            ? o.limitReason
            : o.limitReason === null
              ? null
              : null,
      };
    } catch (e) {
      this.log.warn(
        `Towers restriction read failed user=${u}: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  /**
   * Atomically reserves wager budget for each active rolling window. Rolls back prior windows on failure.
   */
  async tryReserveWagers(
    username: string,
    betAmount: number,
  ): Promise<
    | { ok: true; applied: TowersWagerWindow[] }
    | { ok: false; kind: 'banned'; banReason: string | null }
    | { ok: false; kind: 'limit'; window: TowersWagerWindow }
  > {
    const u = this.norm(username);
    const snap = await this.getRestriction(u);
    if (!snap) {
      return { ok: true, applied: [] };
    }
    if (snap.banned) {
      return { ok: false, kind: 'banned', banReason: snap.banReason };
    }

    const windows: Array<{ w: TowersWagerWindow; max: number }> = [];
    if (this.isPositive(snap.dailyWagerLimit)) {
      windows.push({ w: 'DAILY', max: snap.dailyWagerLimit! });
    }
    if (this.isPositive(snap.weeklyWagerLimit)) {
      windows.push({ w: 'WEEKLY', max: snap.weeklyWagerLimit! });
    }
    if (this.isPositive(snap.monthlyWagerLimit)) {
      windows.push({ w: 'MONTHLY', max: snap.monthlyWagerLimit! });
    }

    if (windows.length === 0) {
      return { ok: true, applied: [] };
    }

    const applied: TowersWagerWindow[] = [];
    for (const { w, max } of windows) {
      const key = RedisKeys.towers.wagerTotal(u, w);
      const ttl = towersWagerWindowTtlSeconds(w);
      try {
        const rawVal = await this.redis.eval(ADD_WAGER_LUA, {
          keys: [key],
          arguments: [String(betAmount), String(max), String(ttl)],
        });
        const res =
          typeof rawVal === 'string'
            ? rawVal
            : Buffer.isBuffer(rawVal)
              ? rawVal.toString('utf8')
              : String(rawVal);

        if (res.startsWith('OK:')) {
          applied.push(w);
          continue;
        }

        for (const prev of applied) {
          await this.rollbackOne(u, prev, betAmount);
        }
        return { ok: false, kind: 'limit', window: w };
      } catch (e) {
        this.log.warn(
          `Towers wager reserve skipped (Redis) user=${u} window=${w}: ${e instanceof Error ? e.message : e}`,
        );
        for (const prev of applied) {
          await this.rollbackOne(u, prev, betAmount);
        }
        return { ok: true, applied: [] };
      }
    }

    return { ok: true, applied };
  }

  async rollbackWagers(
    username: string,
    betAmount: number,
    windows: TowersWagerWindow[],
  ): Promise<void> {
    const u = this.norm(username);
    for (const w of windows) {
      await this.rollbackOne(u, w, betAmount);
    }
  }

  private async rollbackOne(
    u: string,
    w: TowersWagerWindow,
    amount: number,
  ): Promise<void> {
    const key = RedisKeys.towers.wagerTotal(u, w);
    try {
      await this.redis.incrByFloat(key, -amount);
    } catch (e) {
      this.log.warn(
        `Towers wager rollback failed user=${u} window=${w}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private isPositive(n: number | null | undefined): n is number {
    return n != null && Number.isFinite(n) && n > 0;
  }
}
