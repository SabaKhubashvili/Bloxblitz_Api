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
  constructor() {
    super('Chance must be between 2 and 98');
  }
}

export class InvalidBetAmountError extends DiceError {
  readonly code = 'DICE_INVALID_BET_AMOUNT';
  constructor() {
    super('Bet amount must be at least 0.01');
  }
}

export class DiceHistoryFetchError extends DiceError {
  readonly code = 'DICE_HISTORY_FETCH_FAILED';
  constructor() {
    super('Failed to retrieve dice history due to a system error');
  }
}
