import { DomainError } from '../../shared/errors/domain.error';

// ── Union type ────────────────────────────────────────────────────────────────

export type RewardCaseError =
  | RewardCaseNotFoundError
  | RewardCaseInactiveError
  | RewardCaseEmptyError
  | RewardCaseLevelLockedError
  | RewardCaseCooldownError
  | RewardCaseInsufficientKeysError
  | RewardCaseRollFailedError;

// ── Individual errors ─────────────────────────────────────────────────────────

export class RewardCaseNotFoundError extends DomainError {
  readonly code = 'REWARD_CASE_NOT_FOUND';
  constructor(slug: string) {
    super(`Reward case not found: ${slug}`);
  }
}

export class RewardCaseInactiveError extends DomainError {
  readonly code = 'REWARD_CASE_INACTIVE';
  constructor() {
    super('Reward case is currently inactive');
  }
}

export class RewardCaseEmptyError extends DomainError {
  readonly code = 'REWARD_CASE_EMPTY';
  constructor() {
    super('Reward case pool has no items configured');
  }
}

export class RewardCaseLevelLockedError extends DomainError {
  readonly code = 'REWARD_CASE_LEVEL_LOCKED';
  constructor(public readonly requiredLevel: number) {
    super(`Level ${requiredLevel} required to open this case`);
  }
}

export class RewardCaseCooldownError extends DomainError {
  readonly code = 'CASE_GLOBAL_COOLDOWN';
  constructor(public readonly endsAt: Date) {
    super(`Case cooldown active until ${endsAt.toISOString()}`);
  }
}

export class RewardCaseInsufficientKeysError extends DomainError {
  readonly code = 'REWARD_CASE_INSUFFICIENT_KEYS';
  constructor() {
    super('Insufficient keys to open this case');
  }
}

export class RewardCaseRollFailedError extends DomainError {
  readonly code = 'REWARD_CASE_ROLL_FAILED';
  constructor() {
    super('Could not select a reward from the case pool');
  }
}
