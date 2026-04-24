import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../../shared/use-case.interface';
import {
  Result,
  Ok,
  Err,
} from '../../../../../domain/shared/types/result.type';
import { Money } from '../../../../../domain/shared/value-objects/money.vo';
import type { IBalanceRepository } from '../../../../../domain/user/ports/balance.repository.port';
import type { IBalanceCachePort } from '../../ports/balance-cache.port';
import type { GetBalanceCommand } from '../../../dto/get-balance.command';
import type { GetBalanceOutputDto } from '../../../dto/get-balance.output-dto';
import {
  UserNotFoundError,
  BalanceFetchError,
  type UserError,
} from '../../../../../domain/user/errors/user.errors';
import {
  BALANCE_REPOSITORY,
  BALANCE_CACHE_PORT,
} from '../../../tokens/user.tokens';

/**
 * How long (seconds) the read-through cache entry lives.
 *
 * 30 s is a deliberate trade-off:
 *  - Short enough that rapid game-engine balance changes are visible quickly.
 *  - Long enough to absorb polling bursts (e.g. a frontend polling every second).
 *
 * This TTL applies only to the API read cache key ("cache:user:balance:{u}").
 * The game-engine live key ("user:balance:{u}") is never expired by this use case.
 */

@Injectable()
export class GetBalanceUseCase implements IUseCase<
  GetBalanceCommand,
  Result<GetBalanceOutputDto, UserError>
> {
  private readonly logger = new Logger(GetBalanceUseCase.name);

  constructor(
    @Inject(BALANCE_REPOSITORY)
    private readonly balanceRepo: IBalanceRepository,
    @Inject(BALANCE_CACHE_PORT)
    private readonly balanceCache: IBalanceCachePort,
  ) {}

  async execute(
    cmd: GetBalanceCommand,
  ): Promise<Result<GetBalanceOutputDto, UserError>> {
    let userBalance: number | null = null;
    let petValueBalance: number | null = null;
    // ── Step 1: Cache-aside read ────────────────────────────────────────────
    // The cache port checks the short-lived API read cache first.
    // On a hit we return immediately — zero DB or game-engine Redis queries.
    try {
      const cachedUserBalance = await this.balanceCache.get(cmd.username);
      const cachedPetValueBalance = await this.balanceCache.getPetValueBalance(
        cmd.username,
      );
      userBalance = cachedUserBalance?.balance ?? null;
      petValueBalance = cachedPetValueBalance?.petValueBalance ?? null;

      if (userBalance !== null && petValueBalance !== null) {
        this.logger.debug(`[GetBalance] Cache hit for ${cmd.username}`);
        return Ok(this.toOutputDto(userBalance, petValueBalance, true));
      }
    } catch (cacheErr) {
      // Cache read failure is non-fatal: log and fall through to the source of truth.
      this.logger.warn(
        `[GetBalance] Cache read failed for ${cmd.username}, falling through to repo`,
        cacheErr,
      );
    }

    // ── Step 2: Authoritative read ──────────────────────────────────────────
    // The repository implementation first checks the game-engine's live Redis
    // balance key ("user:balance:{u}"), then falls back to PostgreSQL.
    // This ensures we always serve the freshest value without touching the DB
    // when the user has been active recently.
    let record: Awaited<
      ReturnType<IBalanceRepository['findBalanceByUsername']>
    >;

    try {
      record = await this.balanceRepo.findBalanceByUsername(cmd.username);
    } catch (repoErr) {
      this.logger.error(
        `[GetBalance] Repository fetch failed for ${cmd.username}`,
        repoErr,
      );
      return Err(new BalanceFetchError());
    }

    if (record === null) {
      return Err(new UserNotFoundError(cmd.username));
    }

    // ── Step 3: Domain validation via Money value object ────────────────────
    // Money enforces:
    //   • finite, non-NaN values
    //   • non-negative amounts
    //   • rounding to exactly 2 decimal places (HALF_UP)
    // A corrupt DB value that fails this check surfaces as a BalanceFetchError
    // rather than leaking an internal exception to the HTTP response.
    let balance: Money;
    let petValueBalanceVo: Money;

    try {
      balance = new Money(record.balance);
      petValueBalanceVo = new Money(record.petValueBalance ?? 0);
    } catch (voErr) {
      this.logger.error(
        `[GetBalance] Money VO validation failed for ${cmd.username}: ` +
          `balance=${record.balance}, petValueBalance=${record.petValueBalance}`,
        voErr,
      );
      return Err(new BalanceFetchError());
    }

    // ── Step 4: Populate cache (fire-and-forget) ────────────────────────────
    // We do NOT await this — a cache write failure must never block the response.
    void this.balanceCache
      .set(cmd.username, {
        balance: balance.amount,
        petValueBalance: petValueBalanceVo.amount,
      })
      .catch((err) =>
        this.logger.warn(
          `[GetBalance] Cache write failed for ${cmd.username}, ` +
            'next request will hit the repo again',
          err,
        ),
      );

    return Ok(
      this.toOutputDto(balance.amount, petValueBalanceVo.amount, false),
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private toOutputDto(
    balance: number,
    petValueBalance: number,
    fromCache: boolean,
  ): GetBalanceOutputDto {
    return {
      balance: this.toTwoDecimalNumber(balance),
      petValueBalance: this.toTwoDecimalNumber(petValueBalance),
      currency: 'COIN',
    };
  }

  /** Avoid IEEE-754 noise in JSON (e.g. 24.229999999999997 → 24.23). */
  private toTwoDecimalNumber(value: number): number {
    return Number.parseFloat(value.toFixed(2));
  }
}
