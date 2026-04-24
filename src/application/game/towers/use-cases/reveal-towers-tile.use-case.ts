import { Inject, Injectable, Logger } from '@nestjs/common';
import { GameStatus, GameType, TowersGameStatus } from '@prisma/client';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { TowersGameRepository } from '../../../../infrastructure/persistance/repositories/game/towers-game.repository';
import { IncrementUserBalanceUseCase } from '../../../balance/use-cases/increment-user-balance.use-case';
import {
  towersDeriveGemTileIndices,
  towersIsGemPick,
} from '../../../../domain/game/towers/towers-fairness.service';
import {
  toTowersBoardRevealDto,
  toTowersGamePublicDto,
} from '../mappers/towers-public.mapper';
import type { TowersRevealResponseDto } from '../dto/towers-game-public.dto';
import {
  TowersGameNotActiveError,
  TowersGameNotFoundError,
  TowersInvalidMoveError,
  type TowersError,
} from '../../../../domain/game/towers/errors/towers.errors';
import { TowersActiveGameService } from '../../../../infrastructure/game/towers/towers-active-game.service';
import { TowersGameAsyncPersistenceService } from '../../../../infrastructure/game/towers/towers-game-async-persistence.service';
import { TowersGameRedisService } from '../../../../infrastructure/game/towers/towers-game-redis.service';
import type { TowersGameEntity } from '../../../../infrastructure/persistance/repositories/game/towers-game.types';
import type { UpdateTowersGameParams } from '../../../../infrastructure/persistance/repositories/game/towers-game.repository';
import { BET_EVENT_PUBLISHER } from '../../mines/tokens/mines.tokens';
import type { IBetEventPublisherPort } from '../../mines/ports/bet-event-publisher.port';
import { MINES_XP_RATE } from '../../../../shared/config/xp-rates.config';
import { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';
import { GrantWagerXpUseCase } from '../../../user/leveling/use-cases/grant-wager-xp.use-case';
import { BumpGlobalUserStatisticsUseCase } from '../../../../infrastructure/persistance/user-statistics/bump-global-user-statistics.use-case';
import { BumpUserGameStatisticsUseCase } from '../../../../infrastructure/persistance/user-statistics/bump-user-game-statistics.use-case';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function toParentGameStatus(status: TowersGameStatus): GameStatus {
  switch (status) {
    case TowersGameStatus.LOST:
      return GameStatus.LOST;
    case TowersGameStatus.COMPLETED:
      return GameStatus.WON;
    case TowersGameStatus.CASHED_OUT:
      return GameStatus.CASHED_OUT;
    default:
      return GameStatus.FINISHED;
  }
}

type LockedRevealOk = {
  dto: TowersRevealResponseDto;
  /** Credit after lock release (win only). */
  credit?: number;
  /** Set when the round ends on this reveal — rakeback + XP (after balance credit if any). */
  terminalSideEffects?: {
    username: string;
    gameHistoryId: string;
    betAmount: number;
    profilePicture: string;
    kind: 'lost' | 'full_clear_win';
    multiplier: number;
    /** Gross coins returned (Mines-style `profit` / `returnedAmount` on wins). */
    grossReturned: number;
  };
};

@Injectable()
export class RevealTowersTileUseCase implements IUseCase<
  { username: string; rowIndex: number; tileIndex: number },
  Result<TowersRevealResponseDto, TowersError>
> {
  private readonly logger = new Logger(RevealTowersTileUseCase.name);

  constructor(
    private readonly repo: TowersGameRepository,
    private readonly incrementBalance: IncrementUserBalanceUseCase,
    private readonly activeGame: TowersActiveGameService,
    private readonly cache: TowersGameRedisService,
    private readonly persist: TowersGameAsyncPersistenceService,
    @Inject(BET_EVENT_PUBLISHER)
    private readonly betEventPublisher: IBetEventPublisherPort,
    private readonly grantWagerXp: GrantWagerXpUseCase,
    private readonly bumpUserGame: BumpUserGameStatisticsUseCase,
    private readonly bumpGlobal: BumpGlobalUserStatisticsUseCase,
  ) {}

  async execute(cmd: {
    username: string;
    rowIndex: number;
    tileIndex: number;
  }): Promise<Result<TowersRevealResponseDto, TowersError>> {
    const user = cmd.username.toLowerCase();
    const { rowIndex, tileIndex } = cmd;

    if (
      !Number.isInteger(rowIndex) ||
      rowIndex < 0 ||
      !Number.isInteger(tileIndex) ||
      tileIndex < 0
    ) {
      return Err(new TowersInvalidMoveError('Invalid row or tile index.'));
    }

    const seed = await this.activeGame.loadActive(user);
    if (!seed) {
      return Err(new TowersGameNotFoundError());
    }
    if (seed.status !== TowersGameStatus.ACTIVE) {
      return Err(new TowersGameNotActiveError());
    }

    let locked: Result<LockedRevealOk, TowersError>;
    try {
      locked = await this.cache.runExclusiveMutation(seed.gameHistoryId, () =>
        this.runRevealLocked(user, rowIndex, tileIndex),
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'TOWERS_LOCK_BUSY') {
        return Err(
          new TowersInvalidMoveError(
            'Another Towers action is in progress. Try again.',
          ),
        );
      }
      throw e;
    }

    if (!locked.ok) {
      return locked;
    }

    if (locked.value.credit != null) {
      await this.incrementBalance.execute(user, locked.value.credit);
    }

    if (locked.value.terminalSideEffects) {
      const t = locked.value.terminalSideEffects;
      setImmediate(() => {
        const xpSource =
          t.kind === 'lost' ? XpSource.GAME_LOSE : XpSource.GAME_WIN;

        const xpAmount = Math.floor(t.betAmount * MINES_XP_RATE);
        void this.grantWagerXp
          .execute({
            username: t.username,
            xpAmount,
            wager: t.betAmount,
            gameId: t.gameHistoryId,
            source: xpSource,
            grantContext: 'towers.reveal.terminal',
          })
          .then((response) => {
            if (response && !response.ok) {
              return;
            }
            // Rakeback queue + pub/sub: do not depend on XP (same idea as mines reveal on bust).
            void this.betEventPublisher
              .publishBetPlaced(
                t.kind === 'lost'
                  ? {
                      type: 'bet',
                      game: 'towers',
                      gameId: t.gameHistoryId,
                      username: t.username,
                      profilePicture: t.profilePicture,
                      multiplier: 0,
                      amount: t.betAmount,
                      returnedAmount: 0,
                      level: response?.value?.currentLevel ?? 1,
                      profit: -t.betAmount,
                      createdAt: Date.now(),
                    }
                  : {
                      type: 'bet',
                      game: 'towers',
                      gameId: t.gameHistoryId,
                      username: t.username,
                      profilePicture: t.profilePicture,
                      multiplier: t.multiplier,
                      amount: t.betAmount,
                      returnedAmount: t.grossReturned,
                      level: response?.value?.currentLevel ?? 1,
                      profit: t.grossReturned,
                      createdAt: Date.now(),
                    },
              )
              .catch((err) =>
                this.logger.error(
                  `[towers.reveal] publishBetPlaced failed user=${t.username} gameId=${t.gameHistoryId}`,
                  err,
                ),
              );
          });
      });
    }

    return Ok(locked.value.dto);
  }

  private async runRevealLocked(
    user: string,
    rowIndex: number,
    tileIndex: number,
  ): Promise<Result<LockedRevealOk, TowersError>> {
    const entity =
      (await this.cache.getActiveForUser(user)) ??
      (await this.repo.findActiveByUser(user));
    if (entity) {
      await this.cache.putActiveGame(entity).catch(() => undefined);
    }
    if (!entity) {
      return Err(new TowersGameNotFoundError());
    }

    if (entity.status !== TowersGameStatus.ACTIVE) {
      return Err(new TowersGameNotActiveError());
    }

    if (rowIndex !== entity.currentRowIndex) {
      return Err(
        new TowersInvalidMoveError(
          'You must play rows in order from the bottom row up.',
        ),
      );
    }

    const row = entity.rowConfigs[rowIndex];
    if (!row || tileIndex >= row.tiles) {
      return Err(new TowersInvalidMoveError('Invalid tile for this row.'));
    }

    if (
      entity.picks[rowIndex] !== null &&
      entity.picks[rowIndex] !== undefined
    ) {
      return Err(new TowersInvalidMoveError('This row was already played.'));
    }

    const gemIndices = towersDeriveGemTileIndices({
      serverSeed: entity.serverSeed,
      clientSeed: entity.clientSeed,
      nonce: entity.nonce,
      rowIndex,
      row,
    });

    const gem = towersIsGemPick(gemIndices, tileIndex);
    const newPicks = [...entity.picks];
    newPicks[rowIndex] = tileIndex;

    if (!gem) {
      const secured =
        rowIndex === 0 ? 1 : (entity.multiplierLadder[rowIndex - 1] ?? 1);

      const patch: UpdateTowersGameParams = {
        status: TowersGameStatus.LOST,
        picks: newPicks,
        currentMultiplier: roundMoney(secured),
      };

      const updatedEntity = this.applyPatch(entity, patch);
      await this.finishTerminalInCache(user, entity, patch, {
        parentStatus: toParentGameStatus(TowersGameStatus.LOST),
        netProfit: -entity.betAmount,
        finalMultiplier: roundMoney(secured),
      });

      return Ok({
        dto: {
          game: toTowersGamePublicDto(updatedEntity),
          outcome: 'bomb',
          verification: toTowersBoardRevealDto(updatedEntity),
        },
        terminalSideEffects: {
          username: user,
          gameHistoryId: entity.gameHistoryId,
          betAmount: entity.betAmount,
          profilePicture: entity.profilePicture ?? '',
          kind: 'lost',
          multiplier: 0,
          grossReturned: 0,
        },
      });
    }

    const newMult = entity.multiplierLadder[rowIndex] ?? 1;
    const isLast = rowIndex >= entity.levels - 1;

    if (isLast) {
      const payout = roundMoney(entity.betAmount * newMult);

      const patch: UpdateTowersGameParams = {
        status: TowersGameStatus.COMPLETED,
        picks: newPicks,
        currentMultiplier: roundMoney(newMult),
        currentRowIndex: entity.levels,
      };

      const updatedEntity = this.applyPatch(entity, patch);
      await this.finishTerminalInCache(user, entity, patch, {
        parentStatus: toParentGameStatus(TowersGameStatus.COMPLETED),
        netProfit: roundMoney(payout - entity.betAmount),
        finalMultiplier: roundMoney(newMult),
      });

      return Ok({
        dto: {
          game: toTowersGamePublicDto(updatedEntity),
          outcome: 'gem',
          payout,
          verification: toTowersBoardRevealDto(updatedEntity),
        },
        credit: payout,
        terminalSideEffects: {
          username: user,
          gameHistoryId: entity.gameHistoryId,
          betAmount: entity.betAmount,
          profilePicture: entity.profilePicture ?? '',
          kind: 'full_clear_win',
          multiplier: roundMoney(newMult),
          grossReturned: payout,
        },
      });
    }

    const patch: UpdateTowersGameParams = {
      status: TowersGameStatus.ACTIVE,
      picks: newPicks,
      currentMultiplier: roundMoney(newMult),
      currentRowIndex: rowIndex + 1,
    };

    const updatedEntity = this.applyPatch(entity, patch);
    const scheduleAsync = await this.putActiveOrFallback(
      entity.id,
      patch,
      updatedEntity,
    );
    if (scheduleAsync) {
      this.persist.scheduleMidGame(entity.id, patch);
    }

    return Ok({
      dto: {
        game: toTowersGamePublicDto(updatedEntity),
        outcome: 'gem',
      },
    });
  }

  private applyPatch(
    base: TowersGameEntity,
    patch: UpdateTowersGameParams,
  ): TowersGameEntity {
    return {
      ...base,
      status: patch.status ?? base.status,
      picks: patch.picks ?? base.picks,
      currentMultiplier: patch.currentMultiplier ?? base.currentMultiplier,
      currentRowIndex: patch.currentRowIndex ?? base.currentRowIndex,
      updatedAt: new Date(),
    };
  }

  /** @returns true if Redis succeeded and async DB sync should still run */
  private async putActiveOrFallback(
    towersRowId: string,
    patch: UpdateTowersGameParams,
    entity: TowersGameEntity,
  ): Promise<boolean> {
    try {
      await this.cache.putActiveGame(entity);
      return true;
    } catch (err) {
      this.logger.warn(
        `[towers.reveal] redis put failed row=${towersRowId}, sync DB fallback`,
        err,
      );
      await this.repo.persistMidGameState(towersRowId, patch);
      return false;
    }
  }

  private async finishTerminalInCache(
    user: string,
    before: TowersGameEntity,
    patch: UpdateTowersGameParams,
    terminal: {
      parentStatus: GameStatus;
      netProfit: number;
      finalMultiplier: number;
    },
  ): Promise<void> {
    let redisOk = true;
    try {
      await this.cache.removeByGameIdAndUser(before.gameHistoryId, user);
    } catch (err) {
      redisOk = false;
      this.logger.error(
        `[towers.reveal] redis terminal eviction failed gameId=${before.gameHistoryId}`,
        err,
      );
      try {
        await this.repo.persistTerminalState({
          towersRowId: before.id,
          gameHistoryId: before.gameHistoryId,
          username: user,
          towersPatch: patch,
          parentStatus: terminal.parentStatus,
          netProfit: terminal.netProfit,
          finalMultiplier: terminal.finalMultiplier,
        });
        this.scheduleTowersStatsBumpsIfFallback({
          username: user,
          betAmount: before.betAmount,
          netProfit: terminal.netProfit,
          finalMultiplier: terminal.finalMultiplier,
        });
      } catch (syncErr) {
        this.logger.error('[towers.reveal] emergency DB sync failed', syncErr);
      }
    }

    if (redisOk) {
      this.persist.scheduleTerminal({
        towersRowId: before.id,
        gameHistoryId: before.gameHistoryId,
        username: user,
        betAmount: before.betAmount,
        towersPatch: patch,
        parentStatus: terminal.parentStatus,
        netProfit: terminal.netProfit,
        finalMultiplier: terminal.finalMultiplier,
      });
    }
  }

  private scheduleTowersStatsBumpsIfFallback(args: {
    username: string;
    betAmount: number;
    netProfit: number;
    finalMultiplier: number;
  }): void {
    const won = args.netProfit > 0;
    const playedAt = new Date();
    this.bumpUserGame.scheduleBump({
      username: args.username,
      gameType: GameType.TOWERS,
      stake: args.betAmount,
      won,
      netProfit: args.netProfit,
      playedAt,
    });
    this.bumpGlobal.scheduleBump({
      username: args.username,
      gameType: GameType.TOWERS,
      stake: args.betAmount,
      won,
      netProfit: args.netProfit,
      playedAt,
      multiplier:
        won && args.finalMultiplier > 0 ? args.finalMultiplier : undefined,
    });
  }
}
