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
  BET_EVENT_PUBLISHER,
} from '../tokens/mines.tokens';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { GameStatus } from '../../../../domain/game/mines/value-objects/game-status.vo';
import { MinesGameMapper } from '../mappers/mines-game.mapper';
import { MINES_XP_RATE } from 'src/shared/config/xp-rates.config';
import { XpSource } from 'src/domain/leveling/enums/xp-source.enum';
import { AddExperienceUseCase } from 'src/application/user/leveling/use-cases/add-experience.use-case';
import type { IBetEventPublisherPort } from '../ports/bet-event-publisher.port';

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
    @Inject(BET_EVENT_PUBLISHER) private readonly betEventPublisher: IBetEventPublisherPort,
    private readonly addExperienceUseCase: AddExperienceUseCase,
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

        setImmediate(() => {
          void this.betEventPublisher.publishBetPlaced({
            type: 'bet',
            game: 'mines',
            gameId: game.id.value,
            username: cmd.username,
            profilePicture: game.profilePicture,
            multiplier: cashoutResult.value.multiplier,
            amount: game.betAmount.amount,
            returnedAmount: cashoutResult.value.profit.amount,
            level: 1,
            profit: cashoutResult.value.profit.amount,
            createdAt: Date.now(),
          });
          void this.grantMinesXp(
            cmd.username,
            game.betAmount.amount,
            game.id.value,
            XpSource.GAME_WIN,
          );
        });

        return Ok(MinesGameMapper.toRevealTileOutputDto(game, false));
      }
    }

    await this.minesRepo.update(game);

    if (game.status !== GameStatus.ACTIVE) {
      // Game closed (mine hit / LOST) — clean up pointer and invalidate history.
      await this.minesRepo.deleteActiveGame(cmd.username);
      
      setImmediate(() => {
        void this.betEventPublisher.publishBetPlaced({
          type: 'bet',
          game: 'mines',
          gameId: game.id.value,
          username: cmd.username,
          profilePicture: game.profilePicture,
          multiplier: 0,
          amount: game.betAmount.amount,
          returnedAmount: 0,
          level: 1,
          profit: -game.betAmount.amount,
          createdAt: Date.now(),
        });
        void this.grantMinesXp(
          cmd.username,
          game.betAmount.amount,
          game.id.value,
          XpSource.GAME_LOSE,
        ).then((response) => {
          if (response && !response.ok) {
            this.logger.warn(
              `[RevealTile] XP grant failed — user=${cmd.username} amount=${game.betAmount.amount} error=${response.error.message}`,
            );
          }
        });
      });
      void this.historyCache.invalidate(cmd.username).catch((err) =>
        this.logger.warn(`[RevealTile] History cache invalidation failed — user=${cmd.username}`, err),
      );
    }

    return Ok(MinesGameMapper.toRevealTileOutputDto(game, revealResult.value.isMine));
  }
  private grantMinesXp(
    username: string,
    betAmount: number,
    gameId: string,
    source: XpSource,
  ) {
    const xpAmount = Math.floor(betAmount * MINES_XP_RATE);
    if (xpAmount <= 0) return Promise.resolve(null);

    return this.addExperienceUseCase
      .execute({
        username,
        amount: xpAmount,
        source,
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
