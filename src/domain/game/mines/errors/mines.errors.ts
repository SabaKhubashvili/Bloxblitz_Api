import { DomainError } from '../../../shared/errors/domain.error';

export abstract class MinesError extends DomainError {}

export class InvalidMineCountError extends MinesError {
  readonly code = 'MINES_INVALID_MINE_COUNT';
  constructor() {
    super('Mine count must be between 1 and gridSize - 1');
  }
}

export class GameNotActiveError extends MinesError {
  readonly code = 'MINES_GAME_NOT_ACTIVE';
  constructor() {
    super('Game is not currently active');
  }
}

export class InvalidTileIndexError extends MinesError {
  readonly code = 'MINES_INVALID_TILE_INDEX';
  constructor() {
    super('Tile index is out of range');
  }
}

export class TileAlreadyRevealedError extends MinesError {
  readonly code = 'MINES_TILE_ALREADY_REVEALED';
  constructor() {
    super('Tile has already been revealed');
  }
}

export class NoTilesRevealedError extends MinesError {
  readonly code = 'MINES_NO_TILES_REVEALED';
  constructor() {
    super('Cannot cash out without revealing at least one tile');
  }
}

export class ActiveGameExistsError extends MinesError {
  readonly code = 'MINES_ACTIVE_GAME_EXISTS';
  constructor() {
    super('A mines game is already in progress for this user');
  }
}

export class GameNotFoundError extends MinesError {
  readonly code = 'MINES_GAME_NOT_FOUND';
  constructor() {
    super('No active mines game found for this user');
  }
}

export class UserSeedNotFoundError extends MinesError {
  readonly code = 'MINES_USER_SEED_NOT_FOUND';
  constructor() {
    super('User seed not found — cannot start game');
  }
}

export class InsufficientBalanceError extends MinesError {
  readonly code = 'MINES_INSUFFICIENT_BALANCE';
  constructor() {
    super('Insufficient balance to place this bet');
  }
}

export class MinesInvalidBetAmountError extends MinesError {
  readonly code = 'MINES_INVALID_BET_AMOUNT';
  constructor() {
    super('Bet amount must be a finite positive number');
  }
}

export class MinesBetBelowMinimumError extends MinesError {
  readonly code = 'MINES_BET_BELOW_MINIMUM';
  constructor(minBet: number) {
    super(`Bet is below the minimum allowed (${minBet})`);
  }
}

export class MinesBetAboveMaximumError extends MinesError {
  readonly code = 'MINES_BET_ABOVE_MAXIMUM';
  constructor(maxBet: number) {
    super(`Bet exceeds the maximum allowed (${maxBet})`);
  }
}

export class MinesHistoryFetchError extends MinesError {
  readonly code = 'MINES_HISTORY_FETCH_FAILED';
  constructor() {
    super('Failed to retrieve mines history due to a system error');
  }
}

export class MinesRoundNotFoundError extends MinesError {
  readonly code = 'MINES_ROUND_NOT_FOUND';
  constructor(gameId: string) {
    super(`Mines round '${gameId}' not found`);
  }
}

export class MinesPlayerBannedError extends MinesError {
  readonly code = 'MINES_PLAYER_BANNED';
  constructor() {
    super('You are restricted from playing Mines');
  }
}

export class MinesBetAboveModerationCapError extends MinesError {
  readonly code = 'MINES_BET_ABOVE_MODERATION_CAP';
  constructor(cap: number) {
    super(`Bet exceeds your current Mines wager limit (${cap})`);
  }
}

export class MinesHourlyGameLimitExceededError extends MinesError {
  readonly code = 'MINES_HOURLY_GAME_LIMIT_EXCEEDED';
  constructor(limit: number) {
    super(
      `You have reached your hourly Mines game limit (${limit} completed games)`,
    );
  }
}

/** New games are not allowed (admin: NEW_GAMES_DISABLED or PAUSED). */
export class NewGamesDisabledError extends MinesError {
  readonly code = 'NEW_GAMES_DISABLED';
  constructor() {
    super('Mines is not accepting new games at this time');
  }
}

/** Gameplay actions are frozen (admin: PAUSED). */
export class MinesPausedError extends MinesError {
  readonly code = 'MINES_PAUSED';
  constructor() {
    super('Mines gameplay is temporarily paused');
  }
}

/** @deprecated Use {@link NewGamesDisabledError} */
export class MinesNewGamesDisabledError extends NewGamesDisabledError {}

/** @deprecated Use {@link MinesPausedError} */
export class MinesGameplayPausedError extends MinesPausedError {}
