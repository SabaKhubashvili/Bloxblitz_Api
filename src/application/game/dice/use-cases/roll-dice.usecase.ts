import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import type { IDiceBalanceLedgerPort } from '../../../../domain/game/dice/ports/dice-balance-ledger.port';
import type { IDiceHistoryRepository } from '../../../../domain/game/dice/ports/dice-history.repository.port';
import type { IDiceConfigPort } from '../ports/dice-config.port';
import type { IBetEventPublisherPort } from '../../mines/ports/bet-event-publisher.port';
import { DiceFairnessDomainService } from '../../../../domain/game/dice/services/dice-fairness.domain-service';
import {
  InsufficientBalanceError,
  UserSeedNotFoundError,
  InvalidChanceError,
  DiceInvalidBetAmountError,
  DiceBetBelowMinimumError,
  DiceBetAboveMaximumError,
  DiceMultiplierExceedsCapError,
  DicePlayerBannedError,
  DiceBetAboveModerationCapError,
  DiceBettingDisabledError,
  type DiceError,
} from '../../../../domain/game/dice/errors/dice.errors';
import type { RollDiceCommand } from '../dto/roll-dice.command';
import type { RollDiceOutputDto } from '../dto/roll-dice.output-dto';
import {
  DICE_CONFIG_PORT,
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
import { DiceModerationRedisService } from '../../../../infrastructure/cache/dice-moderation.redis.service';
import { DiceBettingDisabledRedisService } from '../../../../infrastructure/cache/dice-betting-disabled.redis.service';

@Injectable()
export class RollDiceUseCase implements IUseCase<
  RollDiceCommand,
  Result<RollDiceOutputDto, DiceError>
> {
  private readonly logger = new Logger(RollDiceUseCase.name);

  constructor(
    @Inject(DICE_CONFIG_PORT) private readonly diceConfig: IDiceConfigPort,
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
    private readonly diceModeration: DiceModerationRedisService,
    private readonly diceBettingGate: DiceBettingDisabledRedisService,
  ) {}

  async execute(
    cmd: RollDiceCommand,
  ): Promise<Result<RollDiceOutputDto, DiceError>> {
    if (await this.diceBettingGate.isBettingDisabled()) {
      return this.reject(
        cmd,
        new DiceBettingDisabledError(),
        'betting_globally_disabled',
      );
    }

    const config = await this.diceConfig.getConfig();

    const bet = Math.round(cmd.betAmount * 100) / 100;
    if (!Number.isFinite(bet) || bet <= 0) {
      return this.reject(
        cmd,
        new DiceInvalidBetAmountError(),
        'invalid_bet_amount',
      );
    }
    if (bet < config.minBet) {
      return this.reject(
        cmd,
        new DiceBetBelowMinimumError(config.minBet),
        'bet_below_minimum',
      );
    }
    if (bet > config.maxBet) {
      return this.reject(
        cmd,
        new DiceBetAboveMaximumError(config.maxBet),
        'bet_above_maximum',
      );
    }

    const moderation = await this.diceModeration.getSnapshot(cmd.username);
    if (moderation?.status === 'BANNED') {
      return this.reject(
        cmd,
        new DicePlayerBannedError(),
        'player_banned',
      );
    }
    if (moderation?.status === 'LIMITED' && moderation.maxBetAmount != null) {
      if (bet > moderation.maxBetAmount) {
        return this.reject(
          cmd,
          new DiceBetAboveModerationCapError(moderation.maxBetAmount),
          'bet_above_moderation_cap',
        );
      }
    }

    if (
      cmd.chance < config.minChance ||
      cmd.chance > config.maxChance
    ) {
      return this.reject(
        cmd,
        new InvalidChanceError(config.minChance, config.maxChance),
        'chance_out_of_range',
      );
    }

    const rawMultiplier =
      cmd.rollMode === 'UNDER'
        ? this.fairnessService.calculateMultiplierUnder(
            cmd.chance,
            config.houseEdge,
          )
        : this.fairnessService.calculateMultiplierOver(
            cmd.chance,
            config.houseEdge,
          );
    const roundedMultiplier = Math.round(rawMultiplier * 10_000) / 10_000;

    if (roundedMultiplier > config.maxPayoutMultiplier) {
      return this.reject(
        cmd,
        new DiceMultiplierExceedsCapError(
          config.maxPayoutMultiplier,
          roundedMultiplier,
        ),
        'multiplier_above_cap',
      );
    }

    const seed = await this.seedRepo.findByusername(cmd.username);
    if (!seed) return Err(new UserSeedNotFoundError());

    const betResult = await this.ledger.placeBet({
      username: cmd.username,
      betAmount: bet,
    });

    if (!betResult.success) {
      return Err(new InsufficientBalanceError());
    }

    void this.incrementRaceWager.executeBestEffort({
      username: cmd.username,
      grossBetAmount: bet,
      source: 'dice',
    });

    const nonce = betResult.nonce!;

    const rollResult = this.fairnessService.generateRollResult(
      seed.serverSeed,
      seed.clientSeed,
      nonce,
    );

    const nominalHouseRetain = bet * (config.houseEdge / 100);

    const won = this.fairnessService.isWin(
      rollResult,
      cmd.chance,
      cmd.rollMode,
    );

    const payout = won ? bet * roundedMultiplier : -bet;
    const profit = payout - (won ? bet : 0);
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
      betAmount: bet,
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
        `mode=${cmd.rollMode} won=${won} profit=${roundedProfit} ` +
        `mult=${roundedMultiplier} houseEdgePct=${config.houseEdge} ` +
        `nominalHouseShare=${Math.round(nominalHouseRetain * 100) / 100}`,
    );

    setImmediate(() => {
      void this.betPublisher.publishBetPlaced({
        username: cmd.username,
        game: 'dice',
        gameId: betId,
        profilePicture: cmd.profilePicture ?? '',
        amount: bet,
        returnedAmount: won ? Math.round(bet * roundedMultiplier * 100) / 100 : 0,
        level: 1,
        multiplier: roundedMultiplier,
        profit: roundedProfit,
        createdAt: Date.now(),
        type: 'bet',
      });
      void this.grantXp(cmd.username, bet, betId);
    });

    return Ok({
      id: betId,
      rollResult,
      betAmount: bet,
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

  private reject(
    cmd: RollDiceCommand,
    err: DiceError,
    context: string,
  ): Result<RollDiceOutputDto, DiceError> {
    this.logger.warn(
      `[Dice] config validation rejected user=${cmd.username} ctx=${context} ` +
        `code=${err.code} message=${err.message}`,
    );
    return Err(err);
  }

  private async grantXp(
    username: string,
    betAmount: number,
    betId: string,
  ): Promise<{ ok: boolean; value?: { currentLevel: number } } | null> {
    const xpAmount = Math.floor(betAmount * DICE_XP_RATE);

    const result = await this.addExperienceUseCase.execute({
      username,
      amount: Math.max(0, xpAmount),
      wagerCoins: betAmount,
      source: XpSource.GAME_WIN,
      referenceId: betId,
    });

    return result.ok
      ? { ok: true, value: { currentLevel: result.value.currentLevel } }
      : null;
  }
}
