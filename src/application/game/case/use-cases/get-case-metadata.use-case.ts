import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type {
  ICaseRepository,
  CaseDetailRecord,
  CaseMetadataRecord,
} from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseDetailCachePort } from '../../../../domain/game/case/ports/case-detail-cache.port';
import {
  CaseNotFoundError,
  CaseInactiveError,
  CasePersistenceError,
  type CaseError,
} from '../../../../domain/game/case/errors/case.errors';
import { CaseMetadataDomainService } from '../../../../domain/game/case/services/case-metadata.domain-service';
import { CASE_REPOSITORY, CASE_DETAIL_CACHE } from '../tokens/case.tokens';
import type { GetCaseMetadataQuery } from '../dto/get-case-metadata.query';
import type { CaseMetadataOutputDto } from '../dto/case-metadata.output-dto';

@Injectable()
export class GetCaseMetadataUseCase implements IUseCase<
  GetCaseMetadataQuery,
  Result<CaseMetadataOutputDto, CaseError>
> {
  private readonly logger = new Logger(GetCaseMetadataUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_DETAIL_CACHE)
    private readonly detailCache: ICaseDetailCachePort,
    private readonly metadataService: CaseMetadataDomainService,
  ) {}

  async execute(
    query: GetCaseMetadataQuery,
  ): Promise<Result<CaseMetadataOutputDto, CaseError>> {
    console.log('query.slug', query.slug);
    try {
      const cached = await this.detailCache.get(query.slug);
      if (cached !== null && cached.isActive) {
        return Ok(toMetadataDtoFromDetail(cached, this.metadataService));
      }
    } catch (err) {
      this.logger.warn(
        `[Cases] metadata: detail cache read failed slug=${query.slug}`,
        err,
      );
    }

    let row: CaseMetadataRecord | null;
    try {
      row = await this.caseRepo.findBySlugMetadata(query.slug);
    } catch (err) {
      this.logger.error(
        `[Cases] findBySlugMetadata failed slug=${query.slug}`,
        err,
      );
      return Err(new CasePersistenceError());
    }

    if (!row) return Err(new CaseNotFoundError(query.slug));
    if (!row.isActive) return Err(new CaseInactiveError(query.slug));

    return Ok(toMetadataDtoFromRow(row, this.metadataService));
  }
}

export function toMetadataDtoFromDetail(
  row: CaseDetailRecord,
  svc: CaseMetadataDomainService,
): CaseMetadataOutputDto {
  const itemCount = row.items.length;
  return {
    slug: row.slug,
    name: row.name,
    title: row.name,
    description: svc.buildDescription(row.name, itemCount),
    keywords: svc.buildKeywords({
      name: row.name,
      slug: row.slug,
      variant: row.variant,
    }),
    imageUrl: row.imageUrl,
    variant: row.variant,
    riskLevel: row.riskLevel,
    itemCount,
  };
}

function toMetadataDtoFromRow(
  row: CaseMetadataRecord,
  svc: CaseMetadataDomainService,
): CaseMetadataOutputDto {
  return {
    slug: row.slug,
    name: row.name,
    title: row.name,
    description: svc.buildDescription(row.name, row.itemCount),
    keywords: svc.buildKeywords({
      name: row.name,
      slug: row.slug,
      variant: row.variant,
    }),
    imageUrl: row.imageUrl,
    variant: row.variant,
    riskLevel: row.riskLevel,
    itemCount: row.itemCount,
  };
}
