import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { RedisKeys } from '../../../infrastructure/cache/redis.keys';

const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_SOFT_CAP = 10;
const MIN_VELOCITY_MULT = 0.15;
const VELOCITY_STEP = 0.06;

const MINES_QUICK_TTL_SEC = 120;
const MINES_QUICK_MULT_CAP = 12;

const velocityLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local member = ARGV[3]
local soft = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
local n = redis.call('ZCARD', key)
local mult = 1
if n >= soft then
  mult = math.max(tonumber(ARGV[5]), 1 - (n - (soft - 1)) * tonumber(ARGV[6]))
end
redis.call('ZADD', key, now, member)
local ttl = math.floor(windowMs / 1000) + 15
redis.call('EXPIRE', key, ttl)
return mult
`;

const minesBumpLua = `
local v = redis.call('INCR', KEYS[1])
if v == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return v
`;

@Injectable()
export class RaceWagerSignalsService {
  private readonly logger = new Logger(RaceWagerSignalsService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Records this wager in the velocity window and returns a multiplier that
   * was computed from prior events (concurrency-safe via Redis).
   */
  async takeVelocityMultiplier(username: string): Promise<number> {
    const key = RedisKeys.race.wagerVelocity(username);
    const now = Date.now();
    const member = `${now}:${randomUUID()}`;
    try {
      const raw = await this.redis.eval(velocityLua, {
        keys: [key],
        arguments: [
          String(now),
          String(VELOCITY_WINDOW_MS),
          member,
          String(VELOCITY_SOFT_CAP),
          String(MIN_VELOCITY_MULT),
          String(VELOCITY_STEP),
        ],
      });
      const m = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(m) || m <= 0) return 1;
      return Math.min(1, m);
    } catch (e) {
      this.logger.warn(
        `[RaceWagerSignals] velocity lua failed user=${username}`,
        e,
      );
      return 1;
    }
  }

  minesQuickCashoutMultiplier(username: string): Promise<number> {
    return this.readMinesQuickMultiplier(username);
  }

  async bumpMinesOneTileCashout(username: string): Promise<void> {
    const key = RedisKeys.race.minesQuickStreak(username);
    try {
      await this.redis.eval(minesBumpLua, {
        keys: [key],
        arguments: [String(MINES_QUICK_TTL_SEC)],
      });
    } catch (e) {
      this.logger.warn(
        `[RaceWagerSignals] mines quick-streak bump failed user=${username}`,
        e,
      );
    }
  }

  private async readMinesQuickMultiplier(username: string): Promise<number> {
    try {
      const raw = await this.redis.get<string>(
        RedisKeys.race.minesQuickStreak(username),
      );
      const n = raw ? parseInt(raw, 10) : 0;
      if (!Number.isFinite(n) || n <= 0) return 1;
      const capped = Math.min(n, MINES_QUICK_MULT_CAP);
      return 1 / (1 + 0.28 * capped);
    } catch (e) {
      this.logger.warn(
        `[RaceWagerSignals] mines quick multiplier read failed user=${username}`,
        e,
      );
      return 1;
    }
  }
}
