import { Injectable, Inject } from '@nestjs/common';
import { Ok } from '../../../domain/shared/types/result.type';
import { KINGUIN_CODE_REPOSITORY } from '../tokens/kinguin.tokens';
import type { IKinguinCodeRepository } from '../../../domain/kinguin/ports/kinguin-code.repository.port';

@Injectable()
export class GetKinguinStatsUseCase {
  constructor(
    @Inject(KINGUIN_CODE_REPOSITORY)
    private readonly codeRepo: IKinguinCodeRepository,
  ) {}

  async execute() {
    const counts = await this.codeRepo.countByStatus();
    return Ok({ counts });
  }
}
