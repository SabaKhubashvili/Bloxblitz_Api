import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port.js';
import { LevelingUserNotFoundError, LevelingError } from '../../../../domain/leveling/errors/leveling.errors.js';
import type { ILevelingCachePort } from '../ports/leveling-cache.port.js';
import { LEVELING_REPOSITORY, LEVELING_CACHE_PORT } from '../tokens/leveling.tokens.js';
import { LevelProgressMapper } from '../mappers/level-progress.mapper.js';
import { RakebackRates } from '../../../../domain/rakeback/value-objects/rakeback-rate.vo.js';
import type { GetUserLevelQuery } from '../dto/get-user-level.query.js';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GetUserLevelUseCase
  implements IUseCase<GetUserLevelQuery, Result<LevelProgressOutputDto, LevelingError>>
{
  constructor(
    @Inject(LEVELING_REPOSITORY) private readonly repo:  ILevelingRepository,
    @Inject(LEVELING_CACHE_PORT) private readonly cache: ILevelingCachePort,
  ) {}

  async execute(
    query: GetUserLevelQuery,
  ): Promise<Result<LevelProgressOutputDto, LevelingError>> {
    // ── 1. Resolve level progress (cache-first) ─────────────────────────────
    let levelProgress = await this.cache.getUserLevel(query.username);

    if (true) {
      levelProgress = await this.repo.findByUsername(query.username);
      if (!levelProgress) {
        return Err(new LevelingUserNotFoundError(query.username));
      }
      await this.cache.setUserLevel(query.username, levelProgress);
    }

    // ── 2. XP earned in last 24 h (always fresh from DB) ────────────────────
    const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
    const xpEarnedLast24h = await this.repo.sumXpSince(query.username, since);

    // ── 3. Level-scaled rakeback rate ──────────────────────────────────────
    const rakebackPercent = RakebackRates.forLevel(levelProgress.currentLevel).total * 100;

    return Ok(
      LevelProgressMapper.toOutputDto(levelProgress, {
        xpEarnedLast24h,
        rakebackPercent,
      }),
    );
  }
}
