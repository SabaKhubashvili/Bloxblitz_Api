import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type {
  IRewardCasesCachePort,
  CachedUserBalanceState,
} from '../../../application/rewards/reward-cases/ports/reward-cases-cache.port';
import type { RewardCaseDefinitionDto } from '../../../application/rewards/reward-cases/reward-case-keys.service';

@Injectable()
export class RewardCasesCacheAdapter implements IRewardCasesCachePort {
  private readonly logger = new Logger(RewardCasesCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  // ── Definitions ────────────────────────────────────────────────────────────

  async getDefinitions(): Promise<RewardCaseDefinitionDto[] | null> {
    try {
      return await this.redis.get<RewardCaseDefinitionDto[]>(
        RedisKeys.rewardCases.definitions(),
      );
    } catch (err) {
      this.logger.warn('[RewardCasesCache] getDefinitions failed', err);
      return null;
    }
  }

  async setDefinitions(
    defs: RewardCaseDefinitionDto[],
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.rewardCases.definitions(),
        defs,
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn('[RewardCasesCache] setDefinitions failed', err);
    }
  }

  async invalidateDefinitions(): Promise<void> {
    try {
      await this.redis.del(RedisKeys.rewardCases.definitions());
      this.logger.debug('[RewardCasesCache] definitions invalidated');
    } catch (err) {
      this.logger.warn('[RewardCasesCache] invalidateDefinitions failed', err);
    }
  }

  async acquireDefinitionsLock(ttlMs: number): Promise<boolean> {
    try {
      return await this.redis.lock(
        RedisKeys.rewardCases.definitionsLock(),
        ttlMs,
      );
    } catch (err) {
      this.logger.warn('[RewardCasesCache] acquireDefinitionsLock failed', err);
      return false;
    }
  }

  async releaseDefinitionsLock(): Promise<void> {
    try {
      await this.redis.unlock(RedisKeys.rewardCases.definitionsLock());
    } catch (err) {
      this.logger.warn('[RewardCasesCache] releaseDefinitionsLock failed', err);
    }
  }

  // ── User state ─────────────────────────────────────────────────────────────

  async getUserState(username: string): Promise<CachedUserBalanceState | null> {
    try {
      return await this.redis.get<CachedUserBalanceState>(
        RedisKeys.rewardCases.userState(username),
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] getUserState failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setUserState(
    username: string,
    state: CachedUserBalanceState,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.rewardCases.userState(username),
        state,
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] setUserState failed for ${username}`,
        err,
      );
    }
  }

  async invalidateUserState(username: string): Promise<void> {
    try {
      await this.redis.del(RedisKeys.rewardCases.userState(username));
      this.logger.debug(
        `[RewardCasesCache] user state invalidated for ${username}`,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] invalidateUserState failed for ${username}`,
        err,
      );
    }
  }

  // ── Global 24-hour case cooldown ──────────────────────────────────────────

  async getCooldownTimestamp(username: string): Promise<number | null> {
    try {
      const raw = await this.redis.get<string>(
        RedisKeys.case.cooldown(username),
      );
      if (raw === null) return null;
      const ts = Number(raw);
      return Number.isFinite(ts) ? ts : null;
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] getCooldownTimestamp failed for ${username}`,
        err,
      );
      return null;
    }
  }

  async setCooldown(username: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.case.cooldown(username),
        String(Date.now()),
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] setCooldown failed for ${username}`,
        err,
      );
    }
  }

  // ── Per-user open-lock ────────────────────────────────────────────────────

  async acquireOpenLock(username: string, ttlMs: number): Promise<boolean> {
    try {
      return await this.redis.lock(
        RedisKeys.rewardCases.openLock(username),
        ttlMs,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] acquireOpenLock failed for ${username}`,
        err,
      );
      return false;
    }
  }

  async releaseOpenLock(username: string): Promise<void> {
    try {
      await this.redis.unlock(RedisKeys.rewardCases.openLock(username));
    } catch (err) {
      this.logger.warn(
        `[RewardCasesCache] releaseOpenLock failed for ${username}`,
        err,
      );
    }
  }
}
