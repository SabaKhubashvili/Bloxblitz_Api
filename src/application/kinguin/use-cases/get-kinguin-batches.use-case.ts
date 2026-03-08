import { Injectable, Inject } from '@nestjs/common';
import { Ok } from '../../../domain/shared/types/result.type';
import { KINGUIN_BATCH_REPOSITORY } from '../tokens/kinguin.tokens';
import type { IKinguinBatchRepository } from '../../../domain/kinguin/ports/kinguin-batch.repository.port';

@Injectable()
export class GetKinguinBatchesUseCase {
  constructor(
    @Inject(KINGUIN_BATCH_REPOSITORY)
    private readonly batchRepo: IKinguinBatchRepository,
  ) {}

  async execute() {
    const batches = await this.batchRepo.findMany();
    return Ok({ batches });
  }
}
