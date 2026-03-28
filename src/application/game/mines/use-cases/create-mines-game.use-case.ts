import { Injectable, Inject } from '@nestjs/common';
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
  MINES_GAME_REPOSITORY,
  MINES_BALANCE_LEDGER,
  BET_EVENT_PUBLISHER,
  USER_SEED_REPOSITORY,
} from '../tokens/mines.tokens';
import {
  InsufficientBalanceError,
  UserSeedNotFoundError,
  ActiveGameExistsError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { MinesGameMapper } from '../mappers/mines-game.mapper';
import { IncrementRaceWagerUseCase } from '../../../race/use-cases/increment-race-wager.use-case';
import { GameType } from '@prisma/client';

@Injectable()
export class CreateMinesGameUseCase
  implements IUseCase<CreateMinesGameCommand, Result<MinesGameOutputDto, MinesError>>
{
  constructor(
    @Inject(MINES_GAME_REPOSITORY) private readonly minesRepo: IMinesGameRepository,
    @Inject(MINES_BALANCE_LEDGER)  private readonly ledger: IMinesBalanceLedgerPort,
    @Inject(USER_SEED_REPOSITORY)  private readonly seedRepo: IUserSeedRepository,
    @Inject(BET_EVENT_PUBLISHER)   private readonly betPublisher: IBetEventPublisherPort,
    private readonly fairnessService: MinesFairnessDomainService,
    private readonly incrementRaceWager: IncrementRaceWagerUseCase,
  ) {}

  async execute(
    cmd: CreateMinesGameCommand,
  ): Promise<Result<MinesGameOutputDto, MinesError>> {
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
        revealedTiles: [],
        status: 'ACTIVE',
      },
    });

    if (!betResult.success) {
      if (betResult.error === 'ACTIVE_GAME_EXISTS') return Err(new ActiveGameExistsError());
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
    });

    if (!gameResult.ok) return Err(gameResult.error);

    await this.minesRepo.save(gameResult.value);

    void this.incrementRaceWager.executeBestEffort({
      username: cmd.username,
      grossBetAmount: cmd.betAmount,
      source: 'mines',
    });

    return Ok(MinesGameMapper.toOutputDto(gameResult.value));
  }
}
