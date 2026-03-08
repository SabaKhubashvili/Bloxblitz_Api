import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { DailySpinState } from '../../../../domain/daily-spin/entities/daily-spin-state.entity';
import { SpinPolicy } from '../../../../domain/daily-spin/policies/spin.policy';
import {
  DailySpinLockedError,
  type DailySpinError,
} from '../../../../domain/daily-spin/errors/daily-spin.errors';
import type { IDailySpinRepository } from '../../../../domain/daily-spin/ports/daily-spin.repository.port';
import type { IDailySpinCachePort } from '../ports/daily-spin-cache.port';
import {
  DAILY_SPIN_REPOSITORY,
  DAILY_SPIN_CACHE_PORT,
} from '../tokens/daily-spin.tokens';
import { GetUserLevelUseCase } from '../../../user/leveling/use-cases/get-user-level.use-case';
import type { GetDailySpinStatusQuery } from '../dto/get-daily-spin-status.query';
import type { DailySpinStatusOutputDto } from '../dto/daily-spin.output-dto';
import {
  SPIN_STATUS_CACHE_TTL_S,
} from '../../../../shared/config/spin-prizes.config';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class GetDailySpinStatusUseCase
  implements IUseCase<GetDailySpinStatusQuery, Result<DailySpinStatusOutputDto, DailySpinError>>
{
  private readonly logger = new Logger(GetDailySpinStatusUseCase.name);

  constructor(
    @Inject(DAILY_SPIN_REPOSITORY) private readonly repo:  IDailySpinRepository,
    @Inject(DAILY_SPIN_CACHE_PORT) private readonly cache: IDailySpinCachePort,
    private readonly getUserLevelUseCase: GetUserLevelUseCase,
  ) {}

  async execute(
    query: GetDailySpinStatusQuery,
  ): Promise<Result<DailySpinStatusOutputDto, DailySpinError>> {
    // ── 1. Level check (required before returning status) ──────────────────
    const levelResult = await this.getUserLevelUseCase.execute({ username: query.username });
    if (!levelResult.ok) return Err(new DailySpinLockedError());

    const userLevel = levelResult.value.currentLevel;
    const now       = new Date();

    // ── 2. Cache-first read ────────────────────────────────────────────────
    const cached = await this.cache.getStatus(query.username);
    if (cached) {
      return Ok({
        canSpin:          cached.canSpin,
        nextSpinAt:       cached.nextSpinAt ? new Date(cached.nextSpinAt) : null,
        currentTier:      cached.currentTier,
        minLevelRequired: SpinPolicy.minLevel,
      });
    }

    // ── 3. Resolve 30-day wager for tier display ───────────────────────────
    const since30d   = new Date(now.getTime() - THIRTY_DAYS_MS);
    const wager30d   = await this.repo.get30DayWager(query.username, since30d);
    const tier       = SpinPolicy.resolveTier(wager30d);

    // ── 4. Load spin state (null = never spun) ─────────────────────────────
    const state = (await this.repo.findStateByUsername(query.username))
      ?? DailySpinState.create(query.username);

    const canSpin   = state.canSpin(userLevel, now);
    const nextSpinAt = state.nextSpinAt;

    // ── 5. Populate cache ─────────────────────────────────────────────────
    void this.cache.setStatus(
      query.username,
      {
        canSpin,
        nextSpinAt:  nextSpinAt?.toISOString() ?? null,
        currentTier: tier.tier,
      },
      SPIN_STATUS_CACHE_TTL_S,
    ).catch((err) =>
      this.logger.warn(`[DailySpin] Status cache write failed for ${query.username}`, err),
    );

    return Ok({
      canSpin,
      nextSpinAt,
      currentTier:      tier.tier,
      minLevelRequired: SpinPolicy.minLevel,
    });
  }
}
