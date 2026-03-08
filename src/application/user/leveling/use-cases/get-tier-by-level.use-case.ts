import { Injectable } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { LevelVO } from '../../../../domain/leveling/value-objects/level.vo';
import { InvalidLevelError, LevelingError } from '../../../../domain/leveling/errors/leveling.errors';
import { LevelProgressMapper } from '../mappers/level-progress.mapper';
import type { GetTierByLevelQuery } from '../dto/get-tier-by-level.query';
import type { TierInfoOutputDto } from '../dto/tier-info.output-dto';

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
