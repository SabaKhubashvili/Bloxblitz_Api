import { DomainError } from '../../shared/errors/domain.error';

export abstract class LevelingError extends DomainError {}

export class LevelingUserNotFoundError extends LevelingError {
  readonly code = 'LEVELING_USER_NOT_FOUND';
  constructor(username: string) {
    super(`User "${username}" not found in the leveling system`);
  }
}

export class InvalidXpAmountError extends LevelingError {
  readonly code = 'LEVELING_INVALID_XP_AMOUNT';
  constructor(amount: number) {
    super(`XP amount must be a non-negative integer, got ${amount}`);
  }
}

export class InvalidLevelError extends LevelingError {
  readonly code = 'LEVELING_INVALID_LEVEL';
  constructor(level: number) {
    super(`Level must be between 0 and 100, got ${level}`);
  }
}

export class LevelingPersistenceError extends LevelingError {
  readonly code = 'LEVELING_PERSISTENCE_ERROR';
  constructor(cause: string) {
    super(`Failed to persist level progress: ${cause}`);
  }
}
