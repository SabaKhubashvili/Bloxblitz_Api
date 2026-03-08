import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok } from '../../../../domain/shared/types/result.type';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port';
import type { RakebackError } from '../../../../domain/rakeback/errors/rakeback.errors';
import { RAKEBACK_REPOSITORY } from '../tokens/rakeback.tokens';

/**
 * Standalone use-case that resets streaks for a given type.
 * Called by the scheduler workers at window-close time.
 * Delegates to the same repository batch operation as CloseClaimWindowUseCase
 * but exists as a separate entry-point for explicit invocation.
 */
@Injectable()
export class ResetMissedStreakUseCase
  implements IUseCase<{ type: RakebackType }, Result<number, RakebackError>>
{
  private readonly logger = new Logger(ResetMissedStreakUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
  ) {}

  async execute(input: { type: RakebackType }): Promise<Result<number, RakebackError>> {
    const affected = await this.repo.resetMissedStreaks(input.type);
    this.logger.log(`Reset ${affected} missed ${input.type} streak(s)`);
    return Ok(affected);
  }
}
