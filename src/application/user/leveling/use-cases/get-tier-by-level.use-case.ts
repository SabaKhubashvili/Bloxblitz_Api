import { Injectable } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import { LevelVO } from '../../../../domain/leveling/value-objects/level.vo.js';
import { InvalidLevelError, LevelingError } from '../../../../domain/leveling/errors/leveling.errors.js';
import { LevelProgressMapper } from '../mappers/level-progress.mapper.js';
import type { GetTierByLevelQuery } from '../dto/get-tier-by-level.query.js';
import type { TierInfoOutputDto } from '../dto/tier-info.output-dto.js';

/**
 * Pure, read-only, infrastructure-free use-case.
 * Derives tier information deterministically from a level number without
 * touching the database or cache.
 */
@Injectable()
export class GetTierByLevelUseCase
  implements IUseCase<GetTierByLevelQuery, Result<TierInfoOutputDto, LevelingError>>
{
  async execute(
    query: GetTierByLevelQuery,
  ): Promise<Result<TierInfoOutputDto, LevelingError>> {
    try {
      const levelVO = LevelVO.of(query.level);
      return Ok(
        LevelProgressMapper.toTierInfoDto(
          levelVO.value,
          levelVO.getTierNumber(),
          levelVO.getTierName(),
        ),
      );
    } catch {
      return Err(new InvalidLevelError(query.level));
    }
  }
}
