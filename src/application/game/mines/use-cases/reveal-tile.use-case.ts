import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port';
import type { IMinesCachePort } from '../ports/mines-cache.port';
import type { IMinesBalanceLedgerPort } from '../ports/mines-balance-ledger.port';
import type { IMinesHistoryCachePort } from '../ports/mines-history-cache.port';
import type { RevealTileCommand } from '../dto/reveal-tile.command';
import type { RevealTileOutputDto } from '../dto/mines-game.output-dto';
import {
  MINES_GAME_REPOSITORY,
  MINES_CACHE_PORT,
  MINES_BALANCE_LEDGER,
  MINES_HISTORY_CACHE_PORT,
} from '../tokens/mines.tokens';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { GameStatus } from '../../../../domain/game/mines/value-objects/game-status.vo';
import { MinesGameMapper } from '../mappers/mines-game.mapper';

@Injectable()
export class RevealTileUseCase
  implements IUseCase<RevealTileCommand, Result<RevealTileOutputDto, MinesError>>
{
  private readonly logger = new Logger(RevealTileUseCase.name);

  constructor(
    @Inject(MINES_GAME_REPOSITORY)    private readonly minesRepo: IMinesGameRepository,
    @Inject(MINES_CACHE_PORT)         private readonly minesCache: IMinesCachePort,
    @Inject(MINES_BALANCE_LEDGER)     private readonly ledger: IMinesBalanceLedgerPort,
    @Inject(MINES_HISTORY_CACHE_PORT) private readonly historyCache: IMinesHistoryCachePort,
  ) {}

  async execute(
    cmd: RevealTileCommand,
  ): Promise<Result<RevealTileOutputDto, MinesError>> {
    const game = await this.minesRepo.findActiveByusername(cmd.username);
    if (!game) return Err(new GameNotFoundError());

    const revealResult = game.revealTile(cmd.tileIndex);
    if (!revealResult.ok) return Err(revealResult.error);

    // Auto-cashout: every safe tile has been cleared — treat as an implicit win.
    const safeTileCount = game.gridSize - game.mineCount;
    const allSafeTilesRevealed =
      !revealResult.value.isMine && game.revealedTiles.size === safeTileCount;

    if (allSafeTilesRevealed) {
      const cashoutResult = game.cashout();
      if (cashoutResult.ok) {
        // Credit winnings FIRST — if this throws the game remains active and
        // the auto-cashout will be retried on the client's next request.
        await this.ledger.settlePayout({
          username: cmd.username,
          gameId: game.id.value,
          profit: cashoutResult.value.profit.amount,
          reason: 'AUTO_WIN',
        });
        await this.minesRepo.update(game);
        await this.minesCache.deleteActiveGame(cmd.username, game.id.value);

        // Game closed (AUTO_WIN) — invalidate history cache.
        void this.historyCache.invalidate(cmd.username).catch((err) =>
          this.logger.warn(`[RevealTile] History cache invalidation failed — user=${cmd.username}`, err),
        );

        return Ok(MinesGameMapper.toRevealTileOutputDto(game, false));
      }
    }

    await this.minesRepo.update(game);

    if (game.status !== GameStatus.ACTIVE) {
      // Game closed (mine hit / LOST) — clean up pointer and invalidate history.
      await this.minesRepo.deleteActiveGame(cmd.username);

      void this.historyCache.invalidate(cmd.username).catch((err) =>
        this.logger.warn(`[RevealTile] History cache invalidation failed — user=${cmd.username}`, err),
      );
    }

    return Ok(MinesGameMapper.toRevealTileOutputDto(game, revealResult.value.isMine));
  }
}
