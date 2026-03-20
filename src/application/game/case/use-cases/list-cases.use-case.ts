import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ICaseRepository } from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseListCachePort } from '../../../../domain/game/case/ports/case-list-cache.port';
import { CasePersistenceError } from '../../../../domain/game/case/errors/case.errors';
import { CASE_REPOSITORY, CASE_LIST_CACHE } from '../tokens/case.tokens';
import type { CaseSummaryOutputDto } from '../dto/case.output-dto';
import { CASE_PUBLIC_READ_CACHE_TTL_SECONDS } from '../case-cache.constants';

@Injectable()
export class ListCasesUseCase
  implements IUseCase<void, Result<CaseSummaryOutputDto[], CasePersistenceError>>
{
  private readonly logger = new Logger(ListCasesUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_LIST_CACHE)
    private readonly listCache: ICaseListCachePort,
  ) {}

  async execute(): Promise<Result<CaseSummaryOutputDto[], CasePersistenceError>> {
    let rows: Awaited<ReturnType<ICaseRepository['findAllActive']>>;
    try {
      rows = await this.caseRepo.findAllActive();
    } catch (err) {
      this.logger.error('[Cases] findAllActive failed', err);
      return Err(new CasePersistenceError());
    }

    const dtoList = rows.map(toCaseSummaryDto);

    void this.listCache
      .set(rows, CASE_PUBLIC_READ_CACHE_TTL_SECONDS)
      .catch((e) => this.logger.warn('[Cases] list cache write failed', e));

    return Ok(dtoList);
  }
}

export function toCaseSummaryDto(row: {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: string;
  riskLevel: number;
  sortOrder: number;
}): CaseSummaryOutputDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price,
    variant: row.variant,
    riskLevel: row.riskLevel,
    sortOrder: row.sortOrder,
  };
}
