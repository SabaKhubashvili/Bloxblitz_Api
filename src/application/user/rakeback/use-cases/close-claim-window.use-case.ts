import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok } from '../../../../domain/shared/types/result.type';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port';
import type { RakebackError } from '../../../../domain/rakeback/errors/rakeback.errors';
import { RAKEBACK_REPOSITORY } from '../tokens/rakeback.tokens';

interface CloseWindowInput {
  type: RakebackType.WEEKLY | RakebackType.MONTHLY;
}

@Injectable()
export class CloseClaimWindowUseCase
  implements IUseCase<CloseWindowInput, Result<number, RakebackError>>
{
  private readonly logger = new Logger(CloseClaimWindowUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
  ) {}

  async execute(input: CloseWindowInput): Promise<Result<number, RakebackError>> {
    this.logger.log(`Closing ${input.type} claim window — resetting missed streaks`);

    const affected = await this.repo.resetMissedStreaks(input.type);
    this.logger.log(`${input.type} window closed — ${affected} streak(s) reset`);

    return Ok(affected);
  }
}
