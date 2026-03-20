import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type {
  ICaseRepository,
  CaseDetailRecord,
} from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseDetailCachePort } from '../../../../domain/game/case/ports/case-detail-cache.port';
import {
  CaseNotFoundError,
  CaseInactiveError,
  CasePersistenceError,
  type CaseError,
} from '../../../../domain/game/case/errors/case.errors';
import { CASE_REPOSITORY, CASE_DETAIL_CACHE } from '../tokens/case.tokens';
import type { GetCaseBySlugQuery } from '../dto/get-case-by-slug.query';
import type { CaseDetailOutputDto, CaseItemOutputDto } from '../dto/case.output-dto';
import { CASE_PUBLIC_READ_CACHE_TTL_SECONDS } from '../case-cache.constants';

@Injectable()
export class GetCaseBySlugUseCase
  implements IUseCase<GetCaseBySlugQuery, Result<CaseDetailOutputDto, CaseError>>
{
  private readonly logger = new Logger(GetCaseBySlugUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_DETAIL_CACHE)
    private readonly detailCache: ICaseDetailCachePort,
  ) {}

  async execute(
    query: GetCaseBySlugQuery,
  ): Promise<Result<CaseDetailOutputDto, CaseError>> {
    let row: Awaited<ReturnType<ICaseRepository['findBySlugWithItems']>>;
    try {
      row = await this.caseRepo.findBySlugWithItems(query.slug);
    } catch (err) {
      this.logger.error(`[Cases] findBySlug failed slug=${query.slug}`, err);
      return Err(new CasePersistenceError());
    }

    if (!row) return Err(new CaseNotFoundError(query.slug));
    if (!row.isActive) return Err(new CaseInactiveError(query.slug));

    void this.detailCache
      .set(query.slug, row, CASE_PUBLIC_READ_CACHE_TTL_SECONDS)
      .catch((e) =>
        this.logger.warn(
          `[Cases] detail cache write failed slug=${query.slug}`,
          e,
        ),
      );

    return Ok(toCaseDetailDto(row));
  }
}

export function toCaseDetailDto(row: CaseDetailRecord): CaseDetailOutputDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price,
    variant: row.variant,
    riskLevel: row.riskLevel,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    items: row.items.map(toItemDto),
  };
}

function toItemDto(item: CaseDetailRecord['items'][number]): CaseItemOutputDto {
  return {
    id: item.id,
    petId: item.petId,
    weight: item.weight,
    sortOrder: item.sortOrder,
    variant: item.variant,
    pet: {
      id: item.pet.id,
      name: item.pet.name,
      image: item.pet.image,
      rarity: item.pet.rarity,
      value: item.pet.value,
    },
  };
}
