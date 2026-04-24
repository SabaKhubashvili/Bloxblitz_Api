import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { DailySpinState } from '../../../../domain/daily-spin/entities/daily-spin-state.entity';
import { SpinPolicy } from '../../../../domain/daily-spin/policies/spin.policy';
import {
  DailySpinConcurrentError,
  DailySpinLockedError,
  type DailySpinError,
} from '../../../../domain/daily-spin/errors/daily-spin.errors';
import type { IDailySpinRepository } from '../../../../domain/daily-spin/ports/daily-spin.repository.port';
import type { IDailySpinCachePort } from '../ports/daily-spin-cache.port';
import type { IDailySpinBalancePort } from '../ports/daily-spin-balance.port';
import {
  DAILY_SPIN_REPOSITORY,
  DAILY_SPIN_CACHE_PORT,
  DAILY_SPIN_BALANCE_PORT,
} from '../tokens/daily-spin.tokens';
import { GetUserLevelUseCase } from '../../../user/leveling/use-cases/get-user-level.use-case';
import type { SpinDailyWheelCommand } from '../dto/spin-daily-wheel.command';
import type { SpinResultOutputDto } from '../dto/daily-spin.output-dto';
import { SPIN_LOCK_TTL_MS } from '../../../../shared/config/spin-prizes.config';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SpinDailyWheelUseCase implements IUseCase<
  SpinDailyWheelCommand,
  Result<SpinResultOutputDto, DailySpinError>
> {
  private readonly logger = new Logger(SpinDailyWheelUseCase.name);

  constructor(
    @Inject(DAILY_SPIN_REPOSITORY) private readonly repo: IDailySpinRepository,
    @Inject(DAILY_SPIN_CACHE_PORT) private readonly cache: IDailySpinCachePort,
    @Inject(DAILY_SPIN_BALANCE_PORT)
    private readonly balance: IDailySpinBalancePort,
    private readonly getUserLevelUseCase: GetUserLevelUseCase,
  ) {}

  async execute(
    cmd: SpinDailyWheelCommand,
  ): Promise<Result<SpinResultOutputDto, DailySpinError>> {
    // ── 1. Distributed lock — prevent race conditions / double-spins ────────
    const acquired = await this.cache.acquireSpinLock(
      cmd.username,
      SPIN_LOCK_TTL_MS,
    );
    if (!acquired) return Err(new DailySpinConcurrentError());

    try {
      // ── 2. Resolve user level via existing service ───────────────────────
      const levelResult = await this.getUserLevelUseCase.execute({
        username: cmd.username,
      });
      if (!levelResult.ok) {
        // If level lookup fails, deny access conservatively
        return Err(new DailySpinLockedError());
      }
      const userLevel = levelResult.value.currentLevel;

      // ── 3. Optimistic level-gate check before hitting DB ─────────────────
      if (!SpinPolicy.meetsLevelRequirement(userLevel)) {
        return Err(new DailySpinLockedError());
      }

      // ── 4. Load or initialise spin state ────────────────────────────────
      const state =
        (await this.repo.findStateByUsername(cmd.username)) ??
        DailySpinState.create(cmd.username);

      // ── 5. Resolve 30-day wager for tier calculation ─────────────────────
      const since30d = new Date(Date.now() - THIRTY_DAYS_MS);
      const wager30d = await this.repo.get30DayWager(cmd.username, since30d);

      // ── 6. Domain spin — validates cooldown, selects prize ───────────────
      const now = new Date();
      const spinResult = state.spin(userLevel, wager30d, now);
      if (!spinResult.ok) return spinResult;

      const { prize, tier, nextSpinAt } = spinResult.value;

      // ── 7. Persist state + history atomically (single Prisma transaction) ─
      await this.repo.saveSpinWithHistory(state, {
        prizeTier: tier.tier,
        prizeAmount: prize.amount,
        prizeLabel: prize.label,
      });

      // ── 8. Credit balance (Redis INCRBYFLOAT + dirty-set) ────────────────
      try {
        await this.balance.creditBalance(cmd.username, prize.amount);
      } catch (err) {
        // The spin was already persisted. Log as critical so it can be
        // compensated — do NOT roll back the spin state.
        this.logger.error(
          `[DailySpin] CRITICAL: spin persisted but balance credit failed ` +
            `user=${cmd.username} amount=${prize.amount}`,
          err,
        );
        // Intentionally do not return an error; the user should not be denied
        // the spin outcome. Monitoring/alerts should catch this log line.
      }

      // ── 9. Invalidate stale spin-status cache ─────────────────────────────
      void this.cache
        .invalidate(cmd.username)
        .catch((err) =>
          this.logger.warn(
            `[DailySpin] Cache invalidation failed for ${cmd.username}`,
            err,
          ),
        );

      return Ok({
        prizeLabel: prize.label,
        prizeAmount: prize.amount,
        prizeTier: tier.tier,
        nextSpinAt,
      });
    } finally {
      await this.cache.releaseSpinLock(cmd.username);
    }
  }
}
