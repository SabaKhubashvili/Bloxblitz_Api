import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import { ClaimWindowPolicy } from '../../../../domain/rakeback/policies/claim-window.policy';
import type { ITimeProvider } from '../../../../domain/rakeback/interfaces/time-provider.interface';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port';
import type { RakebackError } from '../../../../domain/rakeback/errors/rakeback.errors';
import { RAKEBACK_REPOSITORY, TIME_PROVIDER } from '../tokens/rakeback.tokens';

interface OpenWindowInput {
  type: RakebackType.WEEKLY | RakebackType.MONTHLY;
}

@Injectable()
export class OpenClaimWindowUseCase
  implements IUseCase<OpenWindowInput, Result<number, RakebackError>>
{
  private readonly logger = new Logger(OpenClaimWindowUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
    @Inject(TIME_PROVIDER)       private readonly time: ITimeProvider,
  ) {}

  async execute(input: OpenWindowInput): Promise<Result<number, RakebackError>> {
    const now = this.time.now();
    const windowStart = now;
    const windowEnd = ClaimWindowPolicy.windowEnd(windowStart);

    this.logger.log(
      `Opening ${input.type} claim window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
    );

    const affected = await this.repo.openClaimWindow(input.type, windowStart, windowEnd);
    this.logger.log(`${input.type} window opened — ${affected} user(s) have claimable balance`);

    return Ok(affected);
  }
}
