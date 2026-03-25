import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import type { IDiceBalanceLedgerPort } from '../../../../domain/game/dice/ports/dice-balance-ledger.port';
import type { IDiceHistoryRepository } from '../../../../domain/game/dice/ports/dice-history.repository.port';
import type { IBetEventPublisherPort } from '../../mines/ports/bet-event-publisher.port';
import { DiceFairnessDomainService } from '../../../../domain/game/dice/services/dice-fairness.domain-service';
import {
  InsufficientBalanceError,
  UserSeedNotFoundError,
  InvalidChanceError,
  InvalidBetAmountError,
  type DiceError,
} from '../../../../domain/game/dice/errors/dice.errors';
import type { RollDiceCommand } from '../dto/roll-dice.command';
import type { RollDiceOutputDto } from '../dto/roll-dice.output-dto';
import {
  DICE_BALANCE_LEDGER,
  DICE_HISTORY_REPOSITORY,
  USER_SEED_REPOSITORY,
  DICE_BET_EVENT_PUBLISHER,
} from '../tokens/dice.tokens';
import { AddExperienceUseCase } from '../../../user/leveling/use-cases/add-experience.use-case';
import { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';
import { DICE_XP_RATE } from '../../../../shared/config/xp-rates.config';
import { sha256HashServerSeed } from '../../../../domain/shared/provably-fair-hash';
import { IncrementRaceWagerUseCase } from '../../../race/use-cases/increment-race-wager.use-case';

const HOUSE_EDGE_PERCENT = 1;
const MIN_CHANCE = 2;
const MAX_CHANCE = 98;
const MIN_BET = 0.1;

@Injectable()
export class RollDiceUseCase implements IUseCase<
  RollDiceCommand,
  Result<RollDiceOutputDto, DiceError>
> {
  private readonly logger = new Logger(RollDiceUseCase.name);

  constructor(
    @Inject(DICE_BALANCE_LEDGER)
    private readonly ledger: IDiceBalanceLedgerPort,
    @Inject(DICE_HISTORY_REPOSITORY)
    private readonly historyRepo: IDiceHistoryRepository,
    @Inject(USER_SEED_REPOSITORY)
    private readonly seedRepo: IUserSeedRepository,
    @Inject(DICE_BET_EVENT_PUBLISHER)
    private readonly betPublisher: IBetEventPublisherPort,
    private readonly fairnessService: DiceFairnessDomainService,
    private readonly addExperienceUseCase: AddExperienceUseCase,
    private readonly incrementRaceWager: IncrementRaceWagerUseCase,
  ) {}

  async execute(
    cmd: RollDiceCommand,
  ): Promise<Result<RollDiceOutputDto, DiceError>> {
    if (cmd.betAmount < MIN_BET) return Err(new InvalidBetAmountError());
    if (cmd.chance < MIN_CHANCE || cmd.chance > MAX_CHANCE) {
      return Err(new InvalidChanceError());
    }

    const seed = await this.seedRepo.findByusername(cmd.username);
    if (!seed) return Err(new UserSeedNotFoundError());

    const betResult = await this.ledger.placeBet({
      username: cmd.username,
      betAmount: cmd.betAmount,
    });

    if (!betResult.success) {
      return Err(new InsufficientBalanceError());
    }

    void this.incrementRaceWager.executeBestEffort({
      username: cmd.username,
      grossBetAmount: cmd.betAmount,
      source: 'dice',
    });

    const nonce = betResult.nonce!;

    const rollResult = this.fairnessService.generateRollResult(
      seed.serverSeed,
      seed.clientSeed,
      nonce,
    );

    const multiplier =
      cmd.rollMode === 'UNDER'
        ? this.fairnessService.calculateMultiplierUnder(
            cmd.chance,
            HOUSE_EDGE_PERCENT,
          )
        : this.fairnessService.calculateMultiplierOver(
            cmd.chance,
            HOUSE_EDGE_PERCENT,
          );
    const roundedMultiplier = Math.round(multiplier * 10_000) / 10_000;

    const won = this.fairnessService.isWin(
      rollResult,
      cmd.chance,
      cmd.rollMode,
    );

    const payout = won ? cmd.betAmount * roundedMultiplier : -cmd.betAmount;
    const profit = payout - (won ? cmd.betAmount : 0);
    const roundedPayout = Math.round(payout * 100) / 100;
    const roundedProfit = Math.round(profit * 100) / 100;

    if (won) {
      await this.ledger.settlePayout({
        username: cmd.username,
        profit: payout,
      });
    }

    const betId = crypto.randomUUID();
    const serverSeedHash = sha256HashServerSeed(seed.serverSeed);

    this.historyRepo.saveBet({
      id: betId,
      username: cmd.username,
      betAmount: cmd.betAmount,
      chance: cmd.chance,
      rollMode: cmd.rollMode,
      rollResult,
      multiplier: roundedMultiplier,
      payout: roundedPayout,
      profit: roundedProfit,
      clientSeed: seed.clientSeed,
      serverSeedHash,
      nonce,
    });

    this.logger.log(
      `[Dice] user=${cmd.username} roll=${rollResult} chance=${cmd.chance} ` +
        `mode=${cmd.rollMode} won=${won} profit=${roundedProfit}`,
    );

    setImmediate(() => {
      void this.betPublisher.publishBetPlaced({
        username: cmd.username,
        game: 'dice',
        gameId: betId,
        profilePicture: cmd.profilePicture ?? '',
        amount: cmd.betAmount,
        returnedAmount: won ? Math.round(cmd.betAmount * roundedMultiplier * 100) / 100 : 0,
        level: 1,
        multiplier: roundedMultiplier,
        profit: roundedProfit,
        createdAt: Date.now(),
        type: 'bet',
      });
      void this.grantXp(cmd.username, cmd.betAmount, betId);
    });

    return Ok({
      id: betId,
      rollResult,
      betAmount: cmd.betAmount,
      chance: cmd.chance,
      rollMode: cmd.rollMode,
      multiplier: roundedMultiplier,
      payout: roundedPayout,
      profit: roundedProfit,
      won,
      serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce,
    });
  }

  private async grantXp(
    username: string,
    betAmount: number,
    betId: string,
  ): Promise<{ ok: boolean; value?: { currentLevel: number } } | null> {
    const xpAmount = Math.floor(betAmount * DICE_XP_RATE);
    if (xpAmount <= 0) return null;

    const result = await this.addExperienceUseCase.execute({
      username,
      amount: xpAmount,
      source: XpSource.GAME_WIN,
      referenceId: betId,
    });

    return result.ok
      ? { ok: true, value: { currentLevel: result.value.currentLevel } }
      : null;
  }
}
