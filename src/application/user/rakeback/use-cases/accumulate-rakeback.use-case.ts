import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import { RakebackRates } from '../../../../domain/rakeback/value-objects/rakeback-rate.vo.js';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port.js';
import type { IRakebackCachePort } from '../ports/rakeback-cache.port.js';
import type { AccumulateRakebackCommand } from '../dto/accumulate-rakeback.command.js';
import { RakebackAccumulationError, type RakebackError } from '../../../../domain/rakeback/errors/rakeback.errors.js';
import { RAKEBACK_REPOSITORY, RAKEBACK_CACHE_PORT } from '../tokens/rakeback.tokens.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AccumulateRakebackUseCase
  implements IUseCase<AccumulateRakebackCommand, Result<void, RakebackError>>
{
  private readonly logger = new Logger(AccumulateRakebackUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
    @Inject(RAKEBACK_CACHE_PORT) private readonly cache: IRakebackCachePort,
  ) {}

  async execute(cmd: AccumulateRakebackCommand): Promise<Result<void, RakebackError>> {
    try {
      const rates = RakebackRates.forLevel(cmd.userLevel);
      const daily   = round2(cmd.wagerAmount * rates.daily);
      const weekly  = round2(cmd.wagerAmount * rates.weekly);
      const monthly = round2(cmd.wagerAmount * rates.monthly);

      if (daily + weekly + monthly <= 0) return Ok(undefined);

      await this.repo.ensureExists(cmd.username);
      await this.repo.accumulateRakeback(cmd.username, daily, weekly, monthly);
      await this.cache.invalidate(cmd.username).catch((err) =>
        this.logger.warn(`Cache invalidation failed for ${cmd.username}`, err),
      );

      return Ok(undefined);
    } catch (err) {
      this.logger.error(`Accumulation failed for ${cmd.username}`, err);
      return Err(new RakebackAccumulationError(String(err)));
    }
  }
}
