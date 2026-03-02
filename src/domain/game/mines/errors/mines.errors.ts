import { DomainError } from '../../../shared/errors/domain.error.js';

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
