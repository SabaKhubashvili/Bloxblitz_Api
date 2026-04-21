import { Inject, Injectable, Logger } from '@nestjs/common';
import { GameStatus, TowersGameStatus } from '@prisma/client';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { TowersGameRepository } from '../../../../infrastructure/persistance/repositories/game/towers-game.repository';
import { IncrementUserBalanceUseCase } from '../../../balance/use-cases/increment-user-balance.use-case';
import {
  toTowersBoardRevealDto,
  toTowersGamePublicDto,
} from '../mappers/towers-public.mapper';
import type { TowersCashoutResponseDto } from '../dto/towers-game-public.dto';
import {
  TowersGameNotActiveError,
  TowersGameNotFoundError,
  TowersInvalidMoveError,
  type TowersError,
} from '../../../../domain/game/towers/errors/towers.errors';
import { TowersActiveGameService } from '../../../../infrastructure/game/towers/towers-active-game.service';
import { TowersGameAsyncPersistenceService } from '../../../../infrastructure/game/towers/towers-game-async-persistence.service';
import { TowersGameRedisService } from '../../../../infrastructure/game/towers/towers-game-redis.service';
import type { UpdateTowersGameParams } from '../../../../infrastructure/persistance/repositories/game/towers-game.repository';
import { BET_EVENT_PUBLISHER } from '../../mines/tokens/mines.tokens';
import type { IBetEventPublisherPort } from '../../mines/ports/bet-event-publisher.port';
import { MINES_XP_RATE } from '../../../../shared/config/xp-rates.config';
import { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';
import { GrantWagerXpUseCase } from '../../../user/leveling/use-cases/grant-wager-xp.use-case';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class CashoutTowersGameUseCase
  implements
    IUseCase<{ username: string }, Result<TowersCashoutResponseDto, TowersError>>
{
  private readonly logger = new Logger(CashoutTowersGameUseCase.name);

  constructor(
    private readonly repo: TowersGameRepository,
    private readonly incrementBalance: IncrementUserBalanceUseCase,
    private readonly activeGame: TowersActiveGameService,
    private readonly cache: TowersGameRedisService,
    private readonly persist: TowersGameAsyncPersistenceService,
    @Inject(BET_EVENT_PUBLISHER)
    private readonly betEventPublisher: IBetEventPublisherPort,
    private readonly grantWagerXp: GrantWagerXpUseCase,
  ) {}

  async execute(cmd: {
    username: string;
  }): Promise<Result<TowersCashoutResponseDto, TowersError>> {
    const user = cmd.username.toLowerCase();

    const seed = await this.activeGame.loadActive(user);
    if (!seed) {
      return Err(new TowersGameNotFoundError());
    }

    if (seed.status !== TowersGameStatus.ACTIVE) {
      return Err(new TowersGameNotActiveError());
    }

    let boxed: Result<
      {
        dto: TowersCashoutResponseDto;
        payout: number;
        gameHistoryId: string;
        betAmount: number;
        multiplier: number;
        profilePicture: string;
      },
      TowersError
    >;
    try {
      boxed = await this.cache.runExclusiveMutation(seed.gameHistoryId, () =>
        this.runCashoutLocked(user),
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

    if (!boxed.ok) {
      return boxed;
    }

    await this.incrementBalance.execute(user, boxed.value.payout);

    const meta = boxed.value;
    setImmediate(() => {
      const xpAmount = Math.floor(meta.betAmount * MINES_XP_RATE);
      void this.grantWagerXp
        .execute({
          username: user,
          xpAmount,
          wager: meta.betAmount,
          gameId: meta.gameHistoryId,
          source: XpSource.GAME_WIN,
          grantContext: 'towers.cashout',
        })
        .then((response) => {
          if (response && !response.ok) {
            return;
          }
          void this.betEventPublisher
            .publishBetPlaced({
              username: user,
              game: 'towers',
              gameId: meta.gameHistoryId,
              profilePicture: meta.profilePicture,
              amount: meta.betAmount,
              returnedAmount: meta.payout,
              level: response?.value?.currentLevel ?? 1,
              multiplier: meta.multiplier,
              profit: meta.payout,
              createdAt: Date.now(),
              type: 'bet',
            })
            .catch((err) =>
              this.logger.error(
                `[towers.cashout] publishBetPlaced failed user=${user} gameId=${meta.gameHistoryId}`,
                err,
              ),
            );
        });
    });

    return Ok(boxed.value.dto);
  }

  private async runCashoutLocked(
    user: string,
  ): Promise<
    Result<
      {
        dto: TowersCashoutResponseDto;
        payout: number;
        gameHistoryId: string;
        betAmount: number;
        multiplier: number;
        profilePicture: string;
      },
      TowersError
    >
  > {
    let entity =
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

    const payout = roundMoney(entity.betAmount * entity.currentMultiplier);
    const patch: UpdateTowersGameParams = {
      status: TowersGameStatus.CASHED_OUT,
    };

    const updated = {
      ...entity,
      status: TowersGameStatus.CASHED_OUT,
      updatedAt: new Date(),
    };

    let redisOk = true;
    try {
      await this.cache.removeByGameIdAndUser(entity.gameHistoryId, user);
    } catch (err) {
      redisOk = false;
      this.logger.error(
        `[towers.cashout] redis eviction failed gameId=${entity.gameHistoryId}`,
        err,
      );
      try {
        await this.repo.persistTerminalState({
          towersRowId: entity.id,
          gameHistoryId: entity.gameHistoryId,
          username: user,
          towersPatch: patch,
          parentStatus: GameStatus.CASHED_OUT,
          netProfit: roundMoney(payout - entity.betAmount),
          finalMultiplier: entity.currentMultiplier,
        });
      } catch (syncErr) {
        this.logger.error('[towers.cashout] emergency DB sync failed', syncErr);
        this.persist.scheduleTerminal({
          towersRowId: entity.id,
          gameHistoryId: entity.gameHistoryId,
          username: user,
          towersPatch: patch,
          parentStatus: GameStatus.CASHED_OUT,
          netProfit: roundMoney(payout - entity.betAmount),
          finalMultiplier: entity.currentMultiplier,
        });
      }
    }

    if (redisOk) {
      this.persist.scheduleTerminal({
        towersRowId: entity.id,
        gameHistoryId: entity.gameHistoryId,
        username: user,
        towersPatch: patch,
        parentStatus: GameStatus.CASHED_OUT,
        netProfit: roundMoney(payout - entity.betAmount),
        finalMultiplier: entity.currentMultiplier,
      });
    }

    return Ok({
      dto: {
        game: toTowersGamePublicDto(updated),
        payout,
        verification: toTowersBoardRevealDto(updated),
      },
      payout,
      gameHistoryId: entity.gameHistoryId,
      betAmount: entity.betAmount,
      multiplier: entity.currentMultiplier,
      profilePicture: entity.profilePicture ?? '',
    });
  }
}
