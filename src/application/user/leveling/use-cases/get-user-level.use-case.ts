import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port';
import { LevelingUserNotFoundError, LevelingError } from '../../../../domain/leveling/errors/leveling.errors';
import type { ILevelingCachePort } from '../ports/leveling-cache.port';
import { LEVELING_REPOSITORY, LEVELING_CACHE_PORT } from '../tokens/leveling.tokens';
import { LevelProgressMapper } from '../mappers/level-progress.mapper';
import { RakebackRates } from '../../../../domain/rakeback/value-objects/rakeback-rate.vo';
import type { GetUserLevelQuery } from '../dto/get-user-level.query';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto';

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
