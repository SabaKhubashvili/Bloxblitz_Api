import { Injectable, Inject } from '@nestjs/common';
import { Ok } from '../../../domain/shared/types/result.type';
import { KINGUIN_CODE_REPOSITORY } from '../tokens/kinguin.tokens';
import type { IKinguinCodeRepository } from '../../../domain/kinguin/ports/kinguin-code.repository.port';

export interface GetKinguinBatchCodesQuery {
  batchId: string;
  page: number;
  limit: number;
  status?: string;
}

@Injectable()
export class GetKinguinBatchCodesUseCase {
  constructor(
    @Inject(KINGUIN_CODE_REPOSITORY)
    private readonly codeRepo: IKinguinCodeRepository,
  ) {}

  async execute(query: GetKinguinBatchCodesQuery) {
    const { items, total } = await this.codeRepo.findByBatch({
      batchId: query.batchId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
    return Ok({ items, total, page: query.page, limit: query.limit });
  }
}
