import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port';
import type { IRakebackCachePort } from '../ports/rakeback-cache.port';
import type { AccumulateRakebackCommand } from '../dto/accumulate-rakeback.command';
import {
  RakebackAccumulationError,
  type RakebackError,
} from '../../../../domain/rakeback/errors/rakeback.errors';
import {
  RAKEBACK_REPOSITORY,
  RAKEBACK_CACHE_PORT,
} from '../tokens/rakeback.tokens';
import { RAKEBACK_ANTI_ABUSE } from '../../../../domain/rakeback/config/rakeback-anti-abuse.config';
import {
  clampEligibleIncrement,
  isEligibleRakebackWager,
  round2,
} from '../../../../domain/rakeback/services/rakeback-loss-accrual.policy';
import { RedisService } from '../../../../infrastructure/cache/redis.service';

@Injectable()
export class AccumulateRakebackUseCase implements IUseCase<
  AccumulateRakebackCommand,
  Result<void, RakebackError>
> {
  private readonly logger = new Logger(AccumulateRakebackUseCase.name);

  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
    @Inject(RAKEBACK_CACHE_PORT) private readonly cache: IRakebackCachePort,
    private readonly redis: RedisService,
  ) {}

  async execute(
    cmd: AccumulateRakebackCommand,
  ): Promise<Result<void, RakebackError>> {
    try {
      await this.noteRakebackEventRate(cmd.username);

      if (!isEligibleRakebackWager(cmd.wagerAmount)) {
        return Ok(undefined);
      }

      const wagerDelta = round2(clampEligibleIncrement(cmd.wagerAmount));
      const rawReturned = Number.isFinite(cmd.returnedAmount)
        ? Math.max(0, cmd.returnedAmount)
        : 0;
      const wonDelta = round2(clampEligibleIncrement(rawReturned));

      await this.repo.ensureExists(cmd.username);
      await this.repo.applyBetResolutionForRakeback({
        username: cmd.username,
        userLevel: cmd.userLevel,
        eligibleWagerDelta: wagerDelta,
        eligibleWonDelta: wonDelta,
      });

      await this.cache
        .invalidate(cmd.username)
        .catch((err) =>
          this.logger.warn(
            `Cache invalidation failed for ${cmd.username}`,
            err,
          ),
        );

      return Ok(undefined);
    } catch (err) {
      this.logger.error(`Accumulation failed for ${cmd.username}`, err);
      return Err(new RakebackAccumulationError(String(err)));
    }
  }

  /** Soft anti-spam signal: many eligible events in a short window. */
  private async noteRakebackEventRate(username: string): Promise<void> {
    try {
      const key = `rakeback:rapid:${username}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, RAKEBACK_ANTI_ABUSE.RAPID_BET_WINDOW_SEC);
      }
      if (count === RAKEBACK_ANTI_ABUSE.RAPID_BET_WARN_THRESHOLD) {
        this.logger.warn(
          `High rakeback queue rate for ${username}: ${count} events / ${RAKEBACK_ANTI_ABUSE.RAPID_BET_WINDOW_SEC}s window`,
        );
      }
    } catch (e) {
      this.logger.debug(
        `Rakeback rapid-bet counter skipped for ${username}`,
        e,
      );
    }
  }
}
