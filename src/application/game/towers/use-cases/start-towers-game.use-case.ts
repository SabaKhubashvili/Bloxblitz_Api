import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RouletteAdminWagerGateProvider } from '../../../../domain/game/towers/ports/roulette-admin-wager-gate.provider.port';
import type { TowersRuntimeConfigProvider } from '../../../../domain/game/towers/ports/towers-runtime-config.provider.port';
import type { TowersSystemStateProvider } from '../../../../domain/game/towers/ports/towers-system-state.provider.port';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { TowersGameStatus } from '@prisma/client';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import { USER_SEED_REPOSITORY } from '../../dice/tokens/dice.tokens';
import { TowersActiveGameService } from '../../../../infrastructure/game/towers/towers-active-game.service';
import { TowersGameRedisService } from '../../../../infrastructure/game/towers/towers-game-redis.service';
import type { TowersGameEntity } from '../../../../infrastructure/persistance/repositories/game/towers-game.types';
import {
  GAME_SAVE_QUEUE,
  TOWERS_SAVE_GAME_JOB_NAME,
} from '../../../../infrastructure/queue/game-save/game-save.job-data';
import { IncrementUserBalanceUseCase } from '../../../balance/use-cases/increment-user-balance.use-case';
import { DecrementUserBalanceUseCase } from '../../../balance/use-cases/decrement-user-balance.use-case';
import {
  isTowersAllowedLevels,
  isTowersDifficulty,
  towersGenerateRows,
} from '../../../../domain/game/towers/towers.config';
import { TowersMultiplierService } from '../../../../domain/game/towers/towers-multiplier.service';
import { toTowersGamePublicDto } from '../mappers/towers-public.mapper';
import type { TowersStartGameResponseDto } from '../dto/towers-game-public.dto';
import { TOWERS_MULTIPLIER_LADDERS_PREVIEW } from '../../../../domain/game/towers/towers-multiplier.service';
import { ValidateTowersPlayRestrictionUseCase } from './validate-towers-play-restriction.use-case';
import {
  TowersActiveGameExistsError,
  TowersInsufficientBalanceError,
  TowersPersistenceError,
  TowersNewGamesDisabledError,
  TowersRouletteBettingDisabledError,
  TowersRouletteGameDisabledError,
  TowersUserSeedNotFoundError,
  TowersValidationError,
  type TowersError,
} from '../../../../domain/game/towers/errors/towers.errors';
import {
  ROULETTE_ADMIN_WAGER_GATE_PROVIDER,
  TOWERS_RUNTIME_CONFIG_PROVIDER,
  TOWERS_SYSTEM_STATE_PROVIDER,
} from '../tokens/towers.tokens';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function msSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

@Injectable()
export class StartTowersGameUseCase
  implements
    IUseCase<
      {
        username: string;
        profilePicture?: string;
        betAmount: unknown;
        difficulty: unknown;
        levels: unknown;
      },
      Result<TowersStartGameResponseDto, TowersError>
    >
{
  private readonly logger = new Logger(StartTowersGameUseCase.name);

  constructor(
    @Inject(USER_SEED_REPOSITORY)
    private readonly userSeedRepo: IUserSeedRepository,
    @InjectQueue(GAME_SAVE_QUEUE)
    private readonly gameSaveQueue: Queue,
    private readonly activeGame: TowersActiveGameService,
    private readonly towersRedis: TowersGameRedisService,
    private readonly decrementBalance: DecrementUserBalanceUseCase,
    private readonly incrementBalance: IncrementUserBalanceUseCase,
    @Inject(TOWERS_SYSTEM_STATE_PROVIDER)
    private readonly towersSystemState: TowersSystemStateProvider,
    @Inject(TOWERS_RUNTIME_CONFIG_PROVIDER)
    private readonly towersRuntimeConfig: TowersRuntimeConfigProvider,
    @Inject(ROULETTE_ADMIN_WAGER_GATE_PROVIDER)
    private readonly rouletteWagerGate: RouletteAdminWagerGateProvider,
    private readonly validateTowersRestriction: ValidateTowersPlayRestrictionUseCase,
  ) {}

  async execute(cmd: {
    username: string;
    profilePicture?: string;
    betAmount: unknown;
    difficulty: unknown;
    levels: unknown;
  }): Promise<Result<TowersStartGameResponseDto, TowersError>> {
    const betRaw = cmd.betAmount;
    const diffRaw = cmd.difficulty;
    const levelsRaw = cmd.levels;

    if (typeof betRaw !== 'number' || !Number.isFinite(betRaw)) {
      return Err(new TowersValidationError('Invalid bet amount.'));
    }
    if (typeof diffRaw !== 'string' || !isTowersDifficulty(diffRaw)) {
      return Err(new TowersValidationError('Invalid difficulty.'));
    }
    if (typeof levelsRaw !== 'number' || !isTowersAllowedLevels(levelsRaw)) {
      return Err(new TowersValidationError('Invalid levels.'));
    }

    if (await this.towersSystemState.isNewGamesDisabled()) {
      this.logger.warn(
        `[Towers] start blocked new_games_disabled user=${cmd.username}`,
      );
      return Err(new TowersNewGamesDisabledError());
    }

    const rouletteGate = await this.rouletteWagerGate.getWagerGateState();
    if (!rouletteGate.gameEnabled) {
      this.logger.warn(
        `[Towers] start blocked roulette_game_disabled user=${cmd.username}`,
      );
      return Err(new TowersRouletteGameDisabledError());
    }
    this.logger.log(`[Towers] start roulette_game_enabled user=${cmd.username}`, rouletteGate.gameEnabled);
    if (!rouletteGate.bettingEnabled) {
      this.logger.warn(
        `[Towers] start blocked roulette_betting_disabled user=${cmd.username}`,
      );
      return Err(new TowersRouletteBettingDisabledError());
    }

    const runtime = await this.towersRuntimeConfig.getConfig();

    const betAmount = roundMoney(betRaw);
    if (
      betAmount < runtime.minBet ||
      betAmount > runtime.maxBet
    ) {
      return Err(new TowersValidationError('Bet out of allowed range.'));
    }

    const user = cmd.username.toLowerCase();
    const profilePicture =
      typeof cmd.profilePicture === 'string' ? cmd.profilePicture : '';
    const difficulty = diffRaw;
    const levels = levelsRaw;

    const tExec = performance.now();

    let t = performance.now();
    if (await this.activeGame.hasActiveGameQuick(user)) {
      this.logger.debug(
        `[Towers] start perf outcome=active_exists user=${user} total=${msSince(tExec)}ms activeCheck=${msSince(t)}ms`,
      );
      return Err(new TowersActiveGameExistsError());
    }
    const activeCheckMs = msSince(t);

    t = performance.now();
    const userSeed = await this.userSeedRepo.findByusername(user);
    const seedLookupMs = msSince(t);
    if (!userSeed) {
      this.logger.debug(
        `[Towers] start perf outcome=no_seed user=${user} total=${msSince(tExec)}ms activeCheck=${activeCheckMs}ms seedLookup=${seedLookupMs}ms`,
      );
      return Err(new TowersUserSeedNotFoundError());
    }

    t = performance.now();
    const restrictionResult = await this.validateTowersRestriction.validateAndReserve(
      user,
      betAmount,
    );
    const restrictionMs = msSince(t);
    if (!restrictionResult.ok) {
      this.logger.debug(
        `[Towers] start perf outcome=restriction user=${user} total=${msSince(tExec)}ms restriction=${restrictionMs}ms`,
      );
      return Err(restrictionResult.error);
    }
    const wagerReservation = restrictionResult.value;

    t = performance.now();
    const debitResult = await this.decrementBalance.execute(user, betAmount);
    const debitMs = msSince(t);
    if (!debitResult.ok) {
      await this.validateTowersRestriction.rollback(
        user,
        betAmount,
        wagerReservation,
      );
      if (debitResult.reason === 'insufficient_funds') {
        this.logger.debug(
          `[Towers] start perf outcome=insufficient_funds user=${user} total=${msSince(tExec)}ms activeCheck=${activeCheckMs}ms seedLookup=${seedLookupMs}ms restriction=${restrictionMs}ms debit=${debitMs}ms`,
        );
        return Err(new TowersInsufficientBalanceError());
      }
      this.logger.debug(
        `[Towers] start perf outcome=debit_validation user=${user} total=${msSince(tExec)}ms activeCheck=${activeCheckMs}ms seedLookup=${seedLookupMs}ms restriction=${restrictionMs}ms debit=${debitMs}ms`,
      );
      return Err(new TowersValidationError('Invalid bet amount.'));
    }

    t = performance.now();
    const nonce = await this.userSeedRepo.reserveNextNonce(user);
    const nonceMs = msSince(t);

    t = performance.now();
    const rowConfigs = towersGenerateRows(difficulty, levels);
    const multiplierLadder = TowersMultiplierService.buildLadder(
      difficulty,
      rowConfigs,
    );
    const picks: (number | null)[] = Array.from(
      { length: levels },
      () => null as number | null,
    );
    const buildMs = msSince(t);

    /**
     * Authoritative in-memory row ids are allocated up front; Redis holds the full
     * `TowersGameEntity` before the HTTP response so reveal/cashout always resolve
     * `towersRowId` / `gameHistoryId` immediately. Durability: BullMQ persists the
     * same payload and the worker inserts with those ids (idempotent on replay).
     */
    let gameHistoryId: string | undefined;
    try {
      gameHistoryId = randomUUID();
      const towersRowId = randomUUID();
      const now = new Date();

      const entity: TowersGameEntity = {
        id: towersRowId,
        gameHistoryId,
        userUsername: user,
        profilePicture,
        betAmount,
        difficulty,
        levels,
        rowConfigs,
        status: TowersGameStatus.ACTIVE,
        currentRowIndex: 0,
        currentMultiplier: 1,
        picks,
        multiplierLadder,
        serverSeed: userSeed.serverSeed,
        serverSeedHash: userSeed.serverSeedHash,
        clientSeed: userSeed.clientSeed,
        nonce,
        createdAt: now,
        updatedAt: now,
      };

      t = performance.now();
      await this.towersRedis.putActiveGame(entity);
      const redisMs = msSince(t);

      t = performance.now();
      await this.gameSaveQueue.add(
        TOWERS_SAVE_GAME_JOB_NAME,
        {
          gameHistoryId,
          towersRowId,
          userUsername: user,
          betAmount,
          difficulty,
          levels,
          rowConfigs,
          picks,
          multiplierLadder,
          serverSeed: userSeed.serverSeed,
          serverSeedHash: userSeed.serverSeedHash,
          clientSeed: userSeed.clientSeed,
          nonce,
        },
        {
          jobId: gameHistoryId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      const enqueueMs = msSince(t);

      const totalMs = msSince(tExec);
      this.logger.log(
        `[Towers] start ok user=${user} gameId=${gameHistoryId} levels=${levels} diff=${difficulty} | perf total=${totalMs}ms activeCheck=${activeCheckMs}ms seedLookup=${seedLookupMs}ms debit=${debitMs}ms nonce=${nonceMs}ms build=${buildMs}ms redis=${redisMs}ms enqueue=${enqueueMs}ms`,
      );

      return Ok({
        game: toTowersGamePublicDto(entity),
        multiplierLadders: TOWERS_MULTIPLIER_LADDERS_PREVIEW,
      });
    } catch (err) {
      const totalMs = msSince(tExec);
      this.logger.error(
        `[Towers] start failed after debit; refunding total=${totalMs}ms activeCheck=${activeCheckMs}ms seedLookup=${seedLookupMs}ms debit=${debitMs}ms nonce=${nonceMs}ms build=${buildMs}ms`,
        err,
      );
      await this.validateTowersRestriction.rollback(
        user,
        betAmount,
        wagerReservation,
      );
      await this.userSeedRepo.rollbackLastNonce(user);
      await this.incrementBalance.execute(user, betAmount);
      if (gameHistoryId) {
        await this.towersRedis
          .removeByGameIdAndUser(gameHistoryId, user)
          .catch((e) =>
            this.logger.warn(
              `[Towers] cleanup redis after failed start user=${user} gameId=${gameHistoryId}`,
              e,
            ),
          );
      }
      return Err(new TowersPersistenceError());
    }
  }
}
