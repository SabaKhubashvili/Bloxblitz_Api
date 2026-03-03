import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port.js';
import {
  LevelingUserNotFoundError,
  LevelingError,
} from '../../../../domain/leveling/errors/leveling.errors.js';
import type { ILevelingCachePort } from '../ports/leveling-cache.port.js';
import { LEVELING_REPOSITORY, LEVELING_CACHE_PORT } from '../tokens/leveling.tokens.js';
import { LevelProgressMapper } from '../mappers/level-progress.mapper.js';
import type { SetUserLevelCommand } from '../dto/set-user-level.command.js';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto.js';

/**
 * Administrative use-case that overrides a user's level directly.
 * The XP floor for the new level is enforced by the domain entity.
 */
@Injectable()
export class SetUserLevelUseCase
  implements IUseCase<SetUserLevelCommand, Result<LevelProgressOutputDto, LevelingError>>
{
  constructor(
    @Inject(LEVELING_REPOSITORY) private readonly repo:  ILevelingRepository,
    @Inject(LEVELING_CACHE_PORT) private readonly cache: ILevelingCachePort,
  ) {}

  async execute(
    cmd: SetUserLevelCommand,
  ): Promise<Result<LevelProgressOutputDto, LevelingError>> {
    // ── 1. Load aggregate ────────────────────────────────────────────────────
    const levelProgress = await this.repo.findByUsername(cmd.username);
    if (!levelProgress) {
      return Err(new LevelingUserNotFoundError(cmd.username));
    }

    // ── 2. Domain mutation (validates 0–100 bounds) ──────────────────────────
    const setResult = levelProgress.setLevel(cmd.level);
    if (!setResult.ok) {
      return Err(setResult.error as LevelingError);
    }

    // ── 3. Persist & bust cache ──────────────────────────────────────────────
    await this.repo.update(levelProgress);
    await this.cache.invalidateUserLevel(cmd.username);

    return Ok(LevelProgressMapper.toOutputDto(levelProgress));
  }
}
