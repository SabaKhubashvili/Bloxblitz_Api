import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port';
import {
  LevelingUserNotFoundError,
  LevelingError,
} from '../../../../domain/leveling/errors/leveling.errors';
import type { ILevelingCachePort } from '../ports/leveling-cache.port';
import {
  LEVELING_REPOSITORY,
  LEVELING_CACHE_PORT,
} from '../tokens/leveling.tokens';
import { LevelProgressMapper } from '../mappers/level-progress.mapper';
import type { AddExperienceCommand } from '../dto/add-experience.command';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto';
import { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';
import { RewardCaseKeysService } from '../../../rewards/reward-cases/reward-case-keys.service';

const WAGER_KEY_SOURCES = new Set<XpSource>([
  XpSource.GAME_WIN,
  XpSource.GAME_LOSE,
  XpSource.REFERRAL_WAGER,
]);

/**
 * Grants XP to a user, recalculates their level and tier, persists the change,
 * logs an audit event, and invalidates the cache.
 */
@Injectable()
export class AddExperienceUseCase implements IUseCase<
  AddExperienceCommand,
  Result<LevelProgressOutputDto, LevelingError>
> {
  private readonly logger = new Logger(AddExperienceUseCase.name);

  constructor(
    @Inject(LEVELING_REPOSITORY) private readonly repo: ILevelingRepository,
    @Inject(LEVELING_CACHE_PORT) private readonly cache: ILevelingCachePort,
    private readonly rewardCaseKeys: RewardCaseKeysService,
  ) {}

  async execute(
    cmd: AddExperienceCommand,
  ): Promise<Result<LevelProgressOutputDto, LevelingError>> {
    // ── 1. Load aggregate ────────────────────────────────────────────────────
    const levelProgress = await this.repo.findByUsername(cmd.username);
    if (!levelProgress) {
      return Err(new LevelingUserNotFoundError(cmd.username));
    }

    // ── 2. Domain mutation ───────────────────────────────────────────────────
    const gainResult = levelProgress.addExperience(cmd.amount);
    if (!gainResult.ok) {
      return Err(gainResult.error);
    }

    // ── 3. Persist & audit ───────────────────────────────────────────────────
    await Promise.all([
      this.repo.update(levelProgress),
      this.repo.logXpEvent({
        username: cmd.username,
        amount: cmd.amount,
        source: cmd.source,
        referenceId: cmd.referenceId,
      }),
    ]);

    try {
      if (
        cmd.wagerCoins != null &&
        cmd.wagerCoins > 0 &&
        WAGER_KEY_SOURCES.has(cmd.source)
      ) {
        await this.rewardCaseKeys.grantKeysFromWager(
          cmd.username,
          cmd.wagerCoins,
          cmd.referenceId,
        );
      }
      if (gainResult.value.leveledUp) {
        await this.rewardCaseKeys.grantKeysFromLevelProgress(
          cmd.username,
          gainResult.value.previousLevel,
          gainResult.value.newLevel,
          cmd.referenceId,
        );
      }
      // Grant XP-milestone keys based on the XP gained THIS event (delta),
      // not cumulative total. Each case independently computes floor(xpGained/threshold).
      await this.rewardCaseKeys.grantKeysFromXpMilestone(
        cmd.username,
        cmd.amount,
        cmd.referenceId,
      );
    } catch (err) {
      this.logger.error(
        `[AddExperience] reward-case keys failed user=${cmd.username}`,
        err,
      );
    }

    // ── 4. Invalidate stale cache entry ──────────────────────────────────────
    await this.cache.invalidateUserLevel(cmd.username);

    return Ok(LevelProgressMapper.toOutputDto(levelProgress));
  }
}
