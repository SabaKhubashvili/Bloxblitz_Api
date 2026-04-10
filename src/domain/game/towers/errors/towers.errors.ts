import { DomainError } from '../../../shared/errors/domain.error';

export class TowersValidationError extends DomainError {
  readonly code = 'TOWERS_VALIDATION';
  constructor(message = 'Invalid request.') {
    super(message);
  }
}

export class TowersActiveGameExistsError extends DomainError {
  readonly code = 'TOWERS_ACTIVE_GAME_EXISTS';
  constructor(
    message = 'You already have an active Towers game. Finish or cash out first.',
  ) {
    super(message);
  }
}

export class TowersInsufficientBalanceError extends DomainError {
  readonly code = 'TOWERS_INSUFFICIENT_BALANCE';
  constructor(message = 'Insufficient balance for this bet.') {
    super(message);
  }
}

export class TowersGameNotFoundError extends DomainError {
  readonly code = 'TOWERS_GAME_NOT_FOUND';
  constructor(message = 'No active Towers game.') {
    super(message);
  }
}

export class TowersGameNotActiveError extends DomainError {
  readonly code = 'TOWERS_GAME_NOT_ACTIVE';
  constructor(message = 'This Towers game is not active.') {
    super(message);
  }
}

export class TowersInvalidMoveError extends DomainError {
  readonly code = 'TOWERS_INVALID_MOVE';
  constructor(message = 'Invalid move.') {
    super(message);
  }
}

export class TowersPersistenceError extends DomainError {
  readonly code = 'TOWERS_PERSISTENCE';
  constructor(message = 'Could not persist Towers game.') {
    super(message);
  }
}

/** No provably-fair seed row (same semantics as Mines/Dice user seed guard). */
export class TowersUserSeedNotFoundError extends DomainError {
  readonly code = 'TOWERS_USER_SEED_NOT_FOUND';
  constructor(message = 'User fairness seeds not found. Open Provably Fair to initialize.') {
    super(message);
  }
}

export class TowersNewGamesDisabledError extends DomainError {
  readonly code = 'TOWERS_NEW_GAMES_DISABLED';
  constructor(message = 'Towers is temporarily not accepting new games.') {
    super(message);
  }
}

/** Roulette admin `gameEnabled` is off (hash `roulette:admin:config`). */
export class TowersRouletteGameDisabledError extends DomainError {
  readonly code = 'TOWERS_ROULETTE_GAME_DISABLED';
  constructor(message = 'Roulette is disabled. New Towers games are not available.') {
    super(message);
  }
}

/** Roulette admin `bettingEnabled` is off — no new wagers (including Towers starts). */
export class TowersRouletteBettingDisabledError extends DomainError {
  readonly code = 'TOWERS_ROULETTE_BETTING_DISABLED';
  constructor(
    message = 'Betting is paused. New Towers games are not available.',
  ) {
    super(message);
  }
}

/** Admin ban — enforced from Redis `towers:restrictions`. */
export class TowersPlayerBannedError extends DomainError {
  readonly code = 'TOWERS_PLAYER_BANNED';
  constructor(banReason?: string | null) {
    super(
      banReason?.trim()
        ? `You are blocked from Towers. Reason: ${banReason.trim()}`
        : 'You are blocked from Towers.',
    );
  }
}

/** Rolling daily / weekly / monthly wager cap (Redis counters). */
export class TowersWagerLimitExceededError extends DomainError {
  readonly code = 'TOWERS_WAGER_LIMIT_EXCEEDED';
  constructor(
    public readonly period: 'daily' | 'weekly' | 'monthly',
    message?: string,
  ) {
    super(
      message ??
        (period === 'daily'
          ? 'Daily Towers wager limit reached.'
          : period === 'weekly'
            ? 'Weekly Towers wager limit reached.'
            : 'Monthly Towers wager limit reached.'),
    );
  }
}

export type TowersError =
  | TowersValidationError
  | TowersActiveGameExistsError
  | TowersInsufficientBalanceError
  | TowersGameNotFoundError
  | TowersGameNotActiveError
  | TowersInvalidMoveError
  | TowersPersistenceError
  | TowersUserSeedNotFoundError
  | TowersNewGamesDisabledError
  | TowersRouletteGameDisabledError
  | TowersRouletteBettingDisabledError
  | TowersPlayerBannedError
  | TowersWagerLimitExceededError;
