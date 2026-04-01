import { DomainError } from '../../../shared/errors/domain.error';

export abstract class DiceError extends DomainError {}

export class InsufficientBalanceError extends DiceError {
  readonly code = 'DICE_INSUFFICIENT_BALANCE';
  constructor() {
    super('Insufficient balance to place this bet');
  }
}

export class UserSeedNotFoundError extends DiceError {
  readonly code = 'DICE_USER_SEED_NOT_FOUND';
  constructor() {
    super('User seed not found — cannot perform roll');
  }
}

export class InvalidChanceError extends DiceError {
  readonly code = 'DICE_INVALID_CHANCE';
  constructor(minChance: number, maxChance: number) {
    super(`Chance must be between ${minChance} and ${maxChance}`);
  }
}

/** @deprecated Prefer DiceInvalidBetAmountError — kept for filter / older imports */
export class InvalidBetAmountError extends DiceError {
  readonly code = 'DICE_INVALID_BET_AMOUNT';
  constructor() {
    super('Bet amount must be a finite positive value');
  }
}

export class DiceInvalidBetAmountError extends DiceError {
  readonly code = 'DICE_INVALID_BET_AMOUNT';
  constructor() {
    super('Bet amount must be a finite positive value');
  }
}

export class DiceBetBelowMinimumError extends DiceError {
  readonly code = 'DICE_BET_BELOW_MINIMUM';
  constructor(minBet: number) {
    super(`Bet is below the minimum allowed (${minBet})`);
  }
}

export class DiceBetAboveMaximumError extends DiceError {
  readonly code = 'DICE_BET_ABOVE_MAXIMUM';
  constructor(maxBet: number) {
    super(`Bet exceeds the maximum allowed (${maxBet})`);
  }
}

export class DiceMultiplierExceedsCapError extends DiceError {
  readonly code = 'DICE_MULTIPLIER_EXCEEDS_CAP';
  constructor(cap: number, multiplier: number) {
    super(
      `Payout multiplier ${multiplier} exceeds the configured maximum (${cap})`,
    );
  }
}

export class DiceHistoryFetchError extends DiceError {
  readonly code = 'DICE_HISTORY_FETCH_FAILED';
  constructor() {
    super('Failed to retrieve dice history due to a system error');
  }
}

export class DicePlayerBannedError extends DiceError {
  readonly code = 'DICE_PLAYER_BANNED';
  constructor() {
    super('You are restricted from playing dice');
  }
}

export class DiceBetAboveModerationCapError extends DiceError {
  readonly code = 'DICE_BET_ABOVE_MODERATION_CAP';
  constructor(maxBet: number) {
    super(`Bet exceeds your moderation limit (${maxBet})`);
  }
}

/** Global kill switch — admin disabled all dice stakes. */
export class DiceBettingDisabledError extends DiceError {
  readonly code = 'DICE_BETTING_DISABLED';
  constructor() {
    super('Dice betting is temporarily disabled');
  }
}
