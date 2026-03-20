import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ICaseRepository } from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseListCachePort } from '../../../../domain/game/case/ports/case-list-cache.port';
import {
  CasePersistenceError,
  CaseSlugTakenError,
  CaseUnknownPetsError,
  CaseInvalidItemsError,
  type CaseError,
} from '../../../../domain/game/case/errors/case.errors';
import { CASE_REPOSITORY, CASE_LIST_CACHE } from '../tokens/case.tokens';
import type { CreateCaseCommand } from '../dto/create-case.command';

export interface CreateCaseOutputDto {
  id: string;
}

@Injectable()
export class CreateCaseUseCase
  implements IUseCase<CreateCaseCommand, Result<CreateCaseOutputDto, CaseError>>
{
  private readonly logger = new Logger(CreateCaseUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_LIST_CACHE)
    private readonly listCache: ICaseListCachePort,
  ) {}

  async execute(
    cmd: CreateCaseCommand,
  ): Promise<Result<CreateCaseOutputDto, CaseError>> {
    if (cmd.items.length === 0 || cmd.items.some((i) => i.weight <= 0)) {
      return Err(new CaseInvalidItemsError());
    }

    try {
      const { id } = await this.caseRepo.createWithItems({
        slug: cmd.slug,
        name: cmd.name,
        imageUrl: cmd.imageUrl,
        price: cmd.price,
        variant: cmd.variant,
        riskLevel: cmd.riskLevel,
        isActive: cmd.isActive,
        sortOrder: cmd.sortOrder,
        items: cmd.items,
      });

      void this.listCache.invalidate().catch((e) =>
        this.logger.warn('[Cases] list cache invalidate failed after create', e),
      );

      this.logger.log(
        `[Cases] created slug=${cmd.slug} id=${id} by=${cmd.actorUsername}`,
      );

      return Ok({ id });
    } catch (err) {
      if (err instanceof CaseSlugTakenError) return Err(err);
      if (err instanceof CaseUnknownPetsError) return Err(err);
      this.logger.error(`[Cases] create failed slug=${cmd.slug}`, err);
      return Err(new CasePersistenceError());
    }
  }
}
