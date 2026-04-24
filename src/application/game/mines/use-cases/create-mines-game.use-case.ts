import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { Money } from '../../../../domain/shared/value-objects/money.vo';
import { MinesGame } from '../../../../domain/game/mines/entities/mines-game.entity';
import { MinesFairnessDomainService } from '../../../../domain/game/mines/services/mines-fairness.domain-service';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port';
import type { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import type { CreateMinesGameCommand } from '../dto/create-mines-game.command';
import type { MinesGameOutputDto } from '../dto/mines-game.output-dto';
import type { IMinesBalanceLedgerPort } from '../ports/mines-balance-ledger.port';
import type { IBetEventPublisherPort } from '../ports/bet-event-publisher.port';
import {
  MINES_CONFIG_PORT,
  MINES_GAME_REPOSITORY,
  MINES_BALANCE_LEDGER,
  BET_EVENT_PUBLISHER,
  USER_SEED_REPOSITORY,
  MINES_SYSTEM_STATE_PROVIDER,
} from '../tokens/mines.tokens';
import type { MinesSystemStateProvider } from '../../../../domain/game/mines/ports/mines-system-state.provider.port';
import type { IMinesConfigPort } from '../ports/mines-config.port';
import {
  InsufficientBalanceError,
  UserSeedNotFoundError,
  ActiveGameExistsError,
  MinesError,
  MinesInvalidBetAmountError,
  MinesBetBelowMinimumError,
  MinesBetAboveMaximumError,
  MinesPlayerBannedError,
  MinesBetAboveModerationCapError,
  MinesHourlyGameLimitExceededError,
  NewGamesDisabledError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { MinesGameMapper } from '../mappers/mines-game.mapper';
import { IncrementRaceWagerUseCase } from '../../../race/use-cases/increment-race-wager.use-case';
import { AffiliateWagerCommissionManager } from '../../../user/affiliate/services/affiliate-wager-commission.manager';
import { MinesModerationRedisService } from '../../../../infrastructure/cache/mines-moderation.redis.service';
import {
  GAME_SAVE_QUEUE,
  MINES_SAVE_INITIAL_JOB_NAME,
} from '../../../../infrastructure/queue/game-save/game-save.job-data';

@Injectable()
export class CreateMinesGameUseCase implements IUseCase<
  CreateMinesGameCommand,
  Result<MinesGameOutputDto, MinesError>
> {
  private readonly logger = new Logger(CreateMinesGameUseCase.name);

  constructor(
    @Inject(MINES_CONFIG_PORT) private readonly minesConfig: IMinesConfigPort,
    @Inject(MINES_GAME_REPOSITORY)
    private readonly minesRepo: IMinesGameRepository,
    @Inject(MINES_BALANCE_LEDGER)
    private readonly ledger: IMinesBalanceLedgerPort,
    @Inject(USER_SEED_REPOSITORY)
    private readonly seedRepo: IUserSeedRepository,
    @Inject(BET_EVENT_PUBLISHER)
    private readonly betPublisher: IBetEventPublisherPort,
    @Inject(MINES_SYSTEM_STATE_PROVIDER)
    private readonly minesSystemState: MinesSystemStateProvider,
    private readonly fairnessService: MinesFairnessDomainService,
    private readonly incrementRaceWager: IncrementRaceWagerUseCase,
    private readonly affiliateWagerCommission: AffiliateWagerCommissionManager,
    private readonly minesModeration: MinesModerationRedisService,
    @InjectQueue(GAME_SAVE_QUEUE)
    private readonly gameSaveQueue: Queue,
  ) {}

  async execute(
    cmd: CreateMinesGameCommand,
  ): Promise<Result<MinesGameOutputDto, MinesError>> {
    if (await this.minesSystemState.isNewGamesDisabled()) {
      this.logger.warn(
        {
          event: 'mines.blocked.create_game',
          reason: 'new_games_disabled',
          username: cmd.username,
        },
        'Create game rejected — new games disabled or paused',
      );
      return Err(new NewGamesDisabledError());
    }

    const config = await this.minesConfig.getConfig();

    const bet = cmd.betAmount;
    if (!Number.isFinite(bet) || bet <= 0) {
      return Err(new MinesInvalidBetAmountError());
    }
    if (bet < config.minBet) {
      return Err(new MinesBetBelowMinimumError(config.minBet));
    }
    if (bet > config.maxBet) {
      return Err(new MinesBetAboveMaximumError(config.maxBet));
    }

    const moderation = await this.minesModeration.getSnapshot(cmd.username);
    if (moderation?.status === 'BANNED') {
      return Err(new MinesPlayerBannedError());
    }
    if (moderation?.status === 'LIMITED') {
      if (moderation.maxBetAmount != null && bet > moderation.maxBetAmount) {
        return Err(
          new MinesBetAboveModerationCapError(moderation.maxBetAmount),
        );
      }
      if (
        moderation.maxGamesPerHour != null &&
        moderation.maxGamesPerHour > 0
      ) {
        const completed =
          await this.minesModeration.countCompletionsInRollingHour(
            cmd.username,
          );
        if (completed >= moderation.maxGamesPerHour) {
          return Err(
            new MinesHourlyGameLimitExceededError(moderation.maxGamesPerHour),
          );
        }
      }
    }

    const seed = await this.seedRepo.findByusername(cmd.username);
    if (!seed) return Err(new UserSeedNotFoundError());

    const gameId = crypto.randomUUID();

    // Atomically: guard active game, check balance, deduct bet, persist
    // initial game state to Redis, and mark balance dirty — all in one
    // Lua script executed by the ledger service.
    const betResult = await this.ledger.placeBet({
      username: cmd.username,
      betAmount: cmd.betAmount,
      gameId,
      gameData: {
        id: gameId,
        username: cmd.username,
        betAmount: cmd.betAmount,
        mineCount: cmd.mineCount,
        gridSize: cmd.gridSize,
        houseEdge: config.houseEdge,
        revealedTiles: [],
        status: 'ACTIVE',
      },
    });

    if (!betResult.success) {
      if (betResult.error === 'ACTIVE_GAME_EXISTS')
        return Err(new ActiveGameExistsError());
      return Err(new InsufficientBalanceError());
    }

    const nonce = betResult.nonce!;

    const mineMask = this.fairnessService.generateMineMask(
      seed.serverSeed,
      seed.clientSeed,
      nonce,
      cmd.gridSize,
      cmd.mineCount,
    );

    const gameResult = MinesGame.create({
      id: gameId,
      username: cmd.username,
      profilePicture: cmd.profilePicture,
      betAmount: new Money(cmd.betAmount),
      mineCount: cmd.mineCount,
      mineMask,
      nonce,
      gridSize: cmd.gridSize,
      houseEdge: config.houseEdge,
    });

    if (!gameResult.ok) return Err(gameResult.error);

    const game = gameResult.value;
    await this.minesRepo.save(game);

    try {
      await this.gameSaveQueue.add(
        MINES_SAVE_INITIAL_JOB_NAME,
        {
          gameId: game.id.value,
          username: cmd.username,
          profilePicture: cmd.profilePicture,
          betAmount: cmd.betAmount,
          mineCount: cmd.mineCount,
          gridSize: cmd.gridSize,
          minePositions: game.getMinePositions(),
          nonce,
          houseEdge: config.houseEdge,
        },
        {
          jobId: game.id.value,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (e) {
      this.logger.error(
        {
          event: 'mines.game_save_enqueue_failed',
          username: cmd.username,
          gameId: game.id.value,
        },
        e,
      );
      await this.minesRepo.persistMinesInitialIdempotent(game);
    }

    void this.incrementRaceWager.executeBestEffort({
      username: cmd.username,
      grossBetAmount: cmd.betAmount,
      source: 'mines',
    });

    setImmediate(() => {
      void this.affiliateWagerCommission
        .enqueueWagerCommission({
          bettorUsername: cmd.username,
          wagerAmount: cmd.betAmount,
          sourceEventId: game.id.value,
          game: 'MINES',
        })
        .catch((err) =>
          this.logger.warn(
            `[Mines] affiliate wager commission enqueue failed user=${cmd.username} gameId=${game.id.value}`,
            err,
          ),
        );
    });

    return Ok(MinesGameMapper.toOutputDto(game));
  }
}
