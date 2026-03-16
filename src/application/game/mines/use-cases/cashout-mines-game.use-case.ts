import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port';
import type { IMinesCachePort } from '../ports/mines-cache.port';
import type { IMinesBalanceLedgerPort } from '../ports/mines-balance-ledger.port';
import type { IMinesHistoryCachePort } from '../ports/mines-history-cache.port';
import type { CashoutOutputDto } from '../dto/mines-game.output-dto';
import type { CashoutMinesGameCommand } from '../dto/cashout-mines-game.command';
import {
  MINES_GAME_REPOSITORY,
  MINES_CACHE_PORT,
  MINES_BALANCE_LEDGER,
  MINES_HISTORY_CACHE_PORT,
  BET_EVENT_PUBLISHER,
} from '../tokens/mines.tokens';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { MinesGameMapper } from '../mappers/mines-game.mapper';
import { AddExperienceUseCase } from '../../../user/leveling/use-cases/add-experience.use-case';
import { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';
import { MINES_XP_RATE } from '../../../../shared/config/xp-rates.config';
import type { IBetEventPublisherPort } from '../ports/bet-event-publisher.port';

@Injectable()
export class CashoutMinesGameUseCase
  implements IUseCase<CashoutMinesGameCommand, Result<CashoutOutputDto, MinesError>>
{
  private readonly logger = new Logger(CashoutMinesGameUseCase.name);

  constructor(
    @Inject(MINES_GAME_REPOSITORY)    private readonly minesRepo: IMinesGameRepository,
    @Inject(MINES_CACHE_PORT)         private readonly minesCache: IMinesCachePort,
    @Inject(MINES_BALANCE_LEDGER)     private readonly ledger: IMinesBalanceLedgerPort,
    @Inject(MINES_HISTORY_CACHE_PORT) private readonly historyCache: IMinesHistoryCachePort,
    @Inject(BET_EVENT_PUBLISHER) private readonly betEventPublisher: IBetEventPublisherPort,
    private readonly addExperienceUseCase: AddExperienceUseCase,
  ) {}

  async execute(cmd: CashoutMinesGameCommand): Promise<Result<CashoutOutputDto, MinesError>> {
    const game = await this.minesRepo.findActiveByusername(cmd.username);
    if (!game) return Err(new GameNotFoundError());

    const cashoutResult = game.cashout();
    if (!cashoutResult.ok) return Err(cashoutResult.error);

    // Credit winnings FIRST — if this throws the game remains active so the
    // user can retry.  Only after a successful credit do we close the game.
    await this.ledger.settlePayout({
      username: cmd.username,
      gameId: game.id.value,
      profit: cashoutResult.value.profit.amount,
      reason: 'CASHOUT',
    });

    // Persist the WON status to Redis (and fire-and-forget to PostgreSQL).
    await this.minesRepo.update(game);

    // Remove the active-game pointer so no further actions can be taken.
    await this.minesCache.deleteActiveGame(cmd.username, game.id.value);

 

    // Invalidate history cache so the next history request reflects this round.
    void this.historyCache.invalidate(cmd.username).catch((err) =>
      this.logger.warn(`[Cashout] History cache invalidation failed — user=${cmd.username}`, err),
    );

    // Grant XP based on wagered amount × the Mines XP rate.
    // Fire-and-forget: a failure here must never roll back a successful cashout.
    setImmediate(async()=>{
      await this.grantXp(cmd.username, game.betAmount.amount, game.id.value).then((response)=>{
        if (response && !response.ok ) {
          this.logger.warn(
            `[Cashout] XP grant failed — user=${cmd.username} amount=${game.betAmount.amount} error=${response.error.message}`,
          );
        }else{
          this.betEventPublisher.publishBetPlaced({
            username: cmd.username,
            game: 'mines',
            profilePicture: game.profilePicture,
            amount: game.betAmount.amount,
            level: response?.value.currentLevel || 1,
            multiplier: cashoutResult.value.multiplier,
            profit: cashoutResult.value.profit.amount,
            createdAt: Date.now(),
            type: 'bet',
          });
        }
      });
    });

    return Ok(MinesGameMapper.toCashoutOutputDto(game, cashoutResult.value.profit.amount));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async grantXp(username: string, betAmount: number, gameId: string){
    const xpAmount = Math.floor(betAmount * MINES_XP_RATE);
    if (xpAmount <= 0) return Promise.resolve();

    return this.addExperienceUseCase
      .execute({
        username,
        amount:      xpAmount,
        source:      XpSource.GAME_WIN,
        referenceId: gameId,
      })
      .then((result) => {
        if (!result.ok) {
          this.logger.warn(
            `[Cashout] XP grant failed — user=${username} amount=${xpAmount} error=${result.error.message}`,
          );
        } else {
          this.logger.debug(
            `[Cashout] XP granted — user=${username} xp=${xpAmount} ` +
            `newLevel=${result.value.currentLevel} tier=${result.value.tierName}`,
          );
        }
        return result
      })
      .catch((err) => {
        this.logger.error(
          `[Cashout] Unexpected XP grant error — user=${username}`,
          err,
        );
        return null;
      });
  }
}
