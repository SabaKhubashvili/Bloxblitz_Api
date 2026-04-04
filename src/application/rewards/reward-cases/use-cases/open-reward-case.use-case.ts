import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Ok, Err, type Result } from '../../../../domain/shared/types/result.type';
import {
  RewardCaseCooldownError,
  RewardCaseEmptyError,
  RewardCaseInsufficientKeysError,
  RewardCaseNotFoundError,
  RewardCaseRollFailedError,
  type RewardCaseError,
} from '../../../../domain/reward-cases/errors/reward-case.errors';
import type { RewardCaseDefinitionDto, RewardCaseOpenRewardDto } from '../reward-case-keys.service';
import { RewardCaseKeysService } from '../reward-case-keys.service';
import type { IRewardCasesCachePort } from '../ports/reward-cases-cache.port';
import { REWARD_CASES_CACHE_PORT, REWARD_CASE_OPEN_REPOSITORY } from '../tokens/reward-cases.tokens';
import type {
  IRewardCaseOpenRepository,
} from '../ports/reward-case-open.repository.port';

// ── Constants ─────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_TTL_SECONDS = 86_400;

/** Lock TTL for a single case-open flow (generously long for slow DB). */
const OPEN_LOCK_TTL_MS = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OpenRewardCaseCommand {
  readonly userUsername: string;
  readonly slug: string;
}

export interface OpenRewardCaseResult {
  readonly slug: string;
  readonly title: string;
  readonly rewards: RewardCaseOpenRewardDto[];
  readonly keysSpent: number;
}

// ── Pool helpers (pure, no I/O) ───────────────────────────────────────────────

type PoolItem = RewardCaseDefinitionDto['poolItems'][number];

function pickWeighted(items: PoolItem[]): PoolItem | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0 || items.length === 0) return null;

  let r = Math.random() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

// ── Use case ──────────────────────────────────────────────────────────────────

/**
 * Opens a reward case for a user.
 *
 * Responsibilities (in order):
 *   1. Acquire per-user lock (prevents concurrent opens / double-spend).
 *   2. Resolve the case definition from cache (DB fallback via listDefinitions).
 *   3. Validate: case found, active, non-empty pool, Redis cooldown.
 *   4. Roll the reward item (weighted random, pure in-memory).
 *   5. Execute the repository (DB open + balance credit via IncrementUserBalanceUseCase).
 *   6. Write the Redis cooldown stamp and invalidate the user-state cache.
 *
 * This use-case intentionally contains NO framework-specific logic — NestJS
 * decorators are only used for DI wiring, not for HTTP concerns.
 */
@Injectable()
export class OpenRewardCaseUseCase
  implements IUseCase<OpenRewardCaseCommand, Result<OpenRewardCaseResult, RewardCaseError>>
{
  private readonly logger = new Logger(OpenRewardCaseUseCase.name);

  constructor(
    /** Application-layer service: listDefinitions (cache-first) + invalidateUserState. */
    private readonly rewardCasesService: RewardCaseKeysService,

    @Inject(REWARD_CASES_CACHE_PORT)
    private readonly cache: IRewardCasesCachePort,

    @Inject(REWARD_CASE_OPEN_REPOSITORY)
    private readonly openRepository: IRewardCaseOpenRepository,
  ) {}

  async execute(
    cmd: OpenRewardCaseCommand,
  ): Promise<Result<OpenRewardCaseResult, RewardCaseError>> {
    const { userUsername, slug } = cmd;

    // ── 1. Acquire per-user open lock ───────────────────────────────────────
    const lockAcquired = await this.cache.acquireOpenLock(
      userUsername,
      OPEN_LOCK_TTL_MS,
    );
    if (!lockAcquired) {
      this.logger.warn(
        `[OpenRewardCase] Concurrent open rejected for user=${userUsername}`,
      );
      // Treat as cooldown from the caller's perspective (user is already
      // opening a case in another request).
      return Err(new RewardCaseCooldownError(new Date(Date.now() + OPEN_LOCK_TTL_MS)));
    }

    try {
      return await this._doOpen(userUsername, slug);
    } finally {
      await this.cache.releaseOpenLock(userUsername);
    }
  }

  // ── Private: core open flow ───────────────────────────────────────────────

  private async _doOpen(
    userUsername: string,
    slug: string,
  ): Promise<Result<OpenRewardCaseResult, RewardCaseError>> {
    // ── 2. Resolve definition from cache (DB fallback via listDefinitions) ──
    const definitions = await this.rewardCasesService.listDefinitions();
    const def = definitions.find((d) => d.slug === slug) ?? null;

    if (!def) {
      return Err(new RewardCaseNotFoundError(slug));
    }

    if (def.poolItems.length === 0) {
      return Err(new RewardCaseEmptyError());
    }

    // ── 3. Redis cooldown check (fast path before hitting DB) ───────────────
    const cooldownTs = await this.cache.getCooldownTimestamp(userUsername);
    if (cooldownTs !== null) {
      const endsAt = cooldownTs + COOLDOWN_MS;
      if (endsAt > Date.now()) {
        return Err(new RewardCaseCooldownError(new Date(endsAt)));
      }
    }

    // ── 4. Roll reward (pure, no I/O) ───────────────────────────────────────
    const picked = pickWeighted(def.poolItems);
    if (!picked) {
      return Err(new RewardCaseRollFailedError());
    }

    const variant = picked.variant;
    const value = picked.value;

    const reward: RewardCaseOpenRewardDto = {
      rewardCaseItemId: picked.id,
      petId: picked.petId,
      name: picked.pet.name,
      image: picked.pet.image,
      rarity: picked.pet.rarity,
      variant,
      value,
    };

    // ── 5. DB transaction (cooldown DB fallback + key deduct + records) ─────
    let txResult: { caseSlug: string; caseTitle: string };
    try {
      txResult = await this.openRepository.executeOpen({
        userUsername,
        caseSlug: slug,
        reward,
        cooldownMs: COOLDOWN_MS,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';

      if (code === 'CASE_GLOBAL_COOLDOWN') {
        return Err(new RewardCaseCooldownError(new Date(Date.now() + COOLDOWN_MS)));
      }
      if (code === 'REWARD_CASE_INSUFFICIENT_KEYS') {
        return Err(new RewardCaseInsufficientKeysError());
      }
      if (code === 'REWARD_CASE_NOT_FOUND') {
        return Err(new RewardCaseNotFoundError(slug));
      }
      throw err;
    }

    // ── 6. Persist Redis cooldown + invalidate user-state cache ─────────────
    await this.cache.setCooldown(userUsername, COOLDOWN_TTL_SECONDS);

    void this.rewardCasesService
      .invalidateUserState(userUsername)
      .catch((err) =>
        this.logger.warn(
          `[OpenRewardCase] Cache invalidation failed for user=${userUsername}`,
          err,
        ),
      );

    return Ok({
      slug: txResult.caseSlug,
      title: txResult.caseTitle,
      rewards: [reward],
      keysSpent: 1,
    });
  }
}
