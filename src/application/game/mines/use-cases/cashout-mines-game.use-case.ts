import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port.js';
import type { IMinesCachePort } from '../ports/mines-cache.port.js';
import type { IMinesBalanceLedgerPort } from '../ports/mines-balance-ledger.port.js';
import type { IMinesHistoryCachePort } from '../ports/mines-history-cache.port.js';
import type { CashoutOutputDto } from '../dto/mines-game.output-dto.js';
import type { CashoutMinesGameCommand } from '../dto/cashout-mines-game.command.js';
import {
  MINES_GAME_REPOSITORY,
  MINES_CACHE_PORT,
  MINES_BALANCE_LEDGER,
  MINES_HISTORY_CACHE_PORT,
} from '../tokens/mines.tokens.js';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors.js';
import { MinesGameMapper } from '../mappers/mines-game.mapper.js';

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

    return Ok(MinesGameMapper.toCashoutOutputDto(game, cashoutResult.value.profit.amount));
  }
}
