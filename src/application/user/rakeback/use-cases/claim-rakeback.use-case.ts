import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { ITimeProvider } from '../../../../domain/rakeback/interfaces/time-provider.interface.js';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port.js';
import type { IRakebackCachePort } from '../ports/rakeback-cache.port.js';
import type { IRakebackBalancePort } from '../ports/rakeback-balance.port.js';
import type { ClaimRakebackCommand } from '../dto/claim-rakeback.command.js';
import type { ClaimResultOutputDto } from '../dto/rakeback-data.output-dto.js';
import {
  RakebackNotFoundError,
  RakebackClaimInProgressError,
  type RakebackError,
} from '../../../../domain/rakeback/errors/rakeback.errors.js';
import {
  RAKEBACK_REPOSITORY,
  RAKEBACK_CACHE_PORT,
  RAKEBACK_BALANCE_PORT,
  TIME_PROVIDER,
} from '../tokens/rakeback.tokens.js';

const CLAIM_LOCK_TTL_MS = 5_000;

@Injectable()
export class ClaimRakebackUseCase
  implements IUseCase<ClaimRakebackCommand, Result<ClaimResultOutputDto, RakebackError>>
{
  private readonly logger = new Logger(ClaimRakebackUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY)   private readonly repo: IRakebackRepository,
    @Inject(RAKEBACK_CACHE_PORT)   private readonly cache: IRakebackCachePort,
    @Inject(RAKEBACK_BALANCE_PORT) private readonly balance: IRakebackBalancePort,
    @Inject(TIME_PROVIDER)         private readonly time: ITimeProvider,
  ) {}

  async execute(cmd: ClaimRakebackCommand): Promise<Result<ClaimResultOutputDto, RakebackError>> {
    const acquired = await this.cache.acquireClaimLock(cmd.username, CLAIM_LOCK_TTL_MS);
    if (!acquired) return Err(new RakebackClaimInProgressError());

    try {
      const rakeback = await this.repo.findByUsername(cmd.username);
      if (!rakeback) return Err(new RakebackNotFoundError());

      const now = this.time.now();
      const balanceBefore = await this.balance.getBalance(cmd.username);

      const result = rakeback.claim(cmd.type, now);
      if (!result.ok) return result;

      const { amount, streak, streakPercent, streakReset } = result.value;

      await this.repo.saveClaim(rakeback, {
        type: cmd.type,
        amountClaimed: amount,
        streakDay: streak,
        streakBonus: streakPercent,
        streakReset,
        balanceBefore,
        balanceAfter: Math.round((balanceBefore + amount) * 100) / 100,
      });

      await this.balance.creditBalance(cmd.username, amount);

      void this.cache.invalidate(cmd.username).catch((err) =>
        this.logger.warn(`Cache invalidation after claim failed`, err),
      );

      return Ok({
        type: cmd.type,
        amountClaimed: amount,
        streak,
        streakPercent,
        streakReset,
        newBalance: Math.round((balanceBefore + amount) * 100) / 100,
        nextClaimAvailableAt: result.value.nextClaimAvailableAt,
      });
    } finally {
      await this.cache.releaseClaimLock(cmd.username);
    }
  }
}
