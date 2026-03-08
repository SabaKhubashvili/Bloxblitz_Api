import { DomainError } from '../../shared/errors/domain.error';

export type DailySpinError =
  | DailySpinLockedError
  | DailySpinCooldownActiveError
  | DailySpinConcurrentError
  | DailySpinPersistenceError;

export class DailySpinLockedError extends DomainError {
  readonly code = 'DAILY_SPIN_LOCKED';
  constructor() {
    super('Daily spin unlocks at level 3');
  }
}

export class DailySpinCooldownActiveError extends DomainError {
  readonly code = 'DAILY_SPIN_COOLDOWN_ACTIVE';
  constructor(public readonly nextSpinAt: Date) {
    super(`Daily spin is on cooldown until ${nextSpinAt.toISOString()}`);
  }
}

export class DailySpinConcurrentError extends DomainError {
  readonly code = 'DAILY_SPIN_CONCURRENT';
  constructor() {
    super('A spin is already in progress for this user');
  }
}

export class DailySpinPersistenceError extends DomainError {
  readonly code = 'DAILY_SPIN_PERSISTENCE_ERROR';
  constructor(reason: string) {
    super(`Failed to persist daily spin: ${reason}`);
  }
}
