import { DomainError } from '../../shared/errors/domain.error.js';

export type RakebackError =
  | RakebackNotFoundError
  | RakebackNotUnlockedError
  | RakebackWindowClosedError
  | RakebackAlreadyClaimedError
  | ZeroRakebackBalanceError
  | RakebackClaimInProgressError
  | RakebackAccumulationError;

export class RakebackNotFoundError extends DomainError {
  readonly code = 'RAKEBACK_NOT_FOUND';
  constructor() {
    super('No rakeback record found for this user');
  }
}

export class RakebackNotUnlockedError extends DomainError {
  readonly code = 'RAKEBACK_NOT_UNLOCKED';
  constructor(type: string) {
    super(`${type} rakeback is not yet unlocked`);
  }
}

export class RakebackWindowClosedError extends DomainError {
  readonly code = 'RAKEBACK_WINDOW_CLOSED';
  constructor(type: string) {
    super(`${type} rakeback claim window is not open`);
  }
}

export class RakebackAlreadyClaimedError extends DomainError {
  readonly code = 'RAKEBACK_ALREADY_CLAIMED';
  constructor(type: string) {
    super(`${type} rakeback has already been claimed for this period`);
  }
}

export class ZeroRakebackBalanceError extends DomainError {
  readonly code = 'ZERO_RAKEBACK_BALANCE';
  constructor(type: string) {
    super(`No ${type} rakeback balance to claim`);
  }
}

export class RakebackClaimInProgressError extends DomainError {
  readonly code = 'RAKEBACK_CLAIM_IN_PROGRESS';
  constructor() {
    super('Another claim is already in progress for this user');
  }
}

export class RakebackAccumulationError extends DomainError {
  readonly code = 'RAKEBACK_ACCUMULATION_ERROR';
  constructor(reason: string) {
    super(`Failed to accumulate rakeback: ${reason}`);
  }
}
