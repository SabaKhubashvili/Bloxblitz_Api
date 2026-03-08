import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port';
import {
  LevelingUserNotFoundError,
  LevelingError,
} from '../../../../domain/leveling/errors/leveling.errors';
import type { ILevelingCachePort } from '../ports/leveling-cache.port';
import { LEVELING_REPOSITORY, LEVELING_CACHE_PORT } from '../tokens/leveling.tokens';
import { LevelProgressMapper } from '../mappers/level-progress.mapper';
import type { AddExperienceCommand } from '../dto/add-experience.command';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto';

/**
 * Grants XP to a user, recalculates their level and tier, persists the change,
 * logs an audit event, and invalidates the cache.
 */
@Injectable()
export class AddExperienceUseCase
  implements IUseCase<AddExperienceCommand, Result<LevelProgressOutputDto, LevelingError>>
{
  constructor(
    @Inject(LEVELING_REPOSITORY) private readonly repo:  ILevelingRepository,
    @Inject(LEVELING_CACHE_PORT) private readonly cache: ILevelingCachePort,
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
        username:    cmd.username,
        amount:      cmd.amount,
        source:      cmd.source,
        referenceId: cmd.referenceId,
      }),
    ]);

    // ── 4. Invalidate stale cache entry ──────────────────────────────────────
    await this.cache.invalidateUserLevel(cmd.username);

    return Ok(LevelProgressMapper.toOutputDto(levelProgress));
  }
}
