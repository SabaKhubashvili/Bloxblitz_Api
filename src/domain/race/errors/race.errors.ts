import { DomainError } from '../../shared/errors/domain.error';

export class RaceNotFoundError extends DomainError {
  readonly code = 'RACE_NOT_FOUND';
  constructor(message = 'Race not found') {
    super(message);
  }
}

export class RaceNotActiveError extends DomainError {
  readonly code = 'RACE_NOT_ACTIVE';
  constructor(message = 'Race is not active') {
    super(message);
  }
}

export class RaceAlreadyFinishedError extends DomainError {
  readonly code = 'RACE_ALREADY_FINISHED';
  constructor(message = 'Race has already finished') {
    super(message);
  }
}

export class InvalidRaceWagerError extends DomainError {
  readonly code = 'INVALID_RACE_WAGER';
  constructor(message = 'Wager amount must be positive') {
    super(message);
  }
}

export class InvalidRaceRewardsError extends DomainError {
  readonly code = 'INVALID_RACE_REWARDS';
  constructor(message = 'Each reward position must be between 1 and 10') {
    super(message);
  }
}
