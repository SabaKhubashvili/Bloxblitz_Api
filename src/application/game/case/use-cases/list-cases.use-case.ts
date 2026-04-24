import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ICaseRepository } from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseListCachePort } from '../../../../domain/game/case/ports/case-list-cache.port';
import type { ICaseListFilteredReadPort } from '../../../../domain/game/case/ports/case-list-filtered-read.port';
import {
  isCaseListQueryUnfiltered,
  type CaseListQueryFilter,
} from '../../../../domain/game/case/services/case-list-query.policy';
import { CasePersistenceError } from '../../../../domain/game/case/errors/case.errors';
import {
  CASE_REPOSITORY,
  CASE_LIST_CACHE,
  CASE_LIST_FILTERED_READ,
} from '../tokens/case.tokens';
import type { CaseSummaryOutputDto } from '../dto/case.output-dto';
import { CASE_PUBLIC_READ_CACHE_TTL_SECONDS } from '../case-cache.constants';

@Injectable()
export class ListCasesUseCase implements IUseCase<
  CaseListQueryFilter,
  Result<CaseSummaryOutputDto[], CasePersistenceError>
> {
  private readonly logger = new Logger(ListCasesUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_LIST_CACHE)
    private readonly listCache: ICaseListCachePort,
    @Inject(CASE_LIST_FILTERED_READ)
    private readonly filteredRead: ICaseListFilteredReadPort,
  ) {}

  async execute(
    filters: CaseListQueryFilter = {},
  ): Promise<Result<CaseSummaryOutputDto[], CasePersistenceError>> {
    if (!isCaseListQueryUnfiltered(filters)) {
      try {
        const rows = await this.filteredRead.load(filters, () =>
          this.caseRepo.findAllActive(filters),
        );
        return Ok(rows.map(toCaseSummaryDto));
      } catch (err) {
        this.logger.error('[Cases] findAllActive (filtered) failed', err);
        return Err(new CasePersistenceError());
      }
    }

    let rows: Awaited<ReturnType<ICaseRepository['findAllActive']>> | null =
      null;

    try {
      rows = await this.listCache.get();
    } catch (err) {
      this.logger.warn('[Cases] list cache read failed, using DB', err);
    }

    if (rows === null) {
      try {
        rows = await this.caseRepo.findAllActive({});
      } catch (err) {
        this.logger.error('[Cases] findAllActive failed', err);
        return Err(new CasePersistenceError());
      }

      void this.listCache
        .set(rows, CASE_PUBLIC_READ_CACHE_TTL_SECONDS)
        .catch((e) => this.logger.warn('[Cases] list cache write failed', e));
    }

    return Ok(rows.map(toCaseSummaryDto));
  }
}

export function toCaseSummaryDto(row: {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: string;
  catalogCategory: 'amp' | 'mm2';
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
    category: row.catalogCategory,
    riskLevel: row.riskLevel,
    sortOrder: row.sortOrder,
  };
}
