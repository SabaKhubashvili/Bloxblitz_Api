import { DomainError } from '../../../shared/errors/domain.error';

export abstract class BetHistoryError extends DomainError {}

export class BetHistoryFetchError extends BetHistoryError {
  readonly code = 'BET_HISTORY_FETCH_FAILED';
  constructor() {
    super('Failed to retrieve bet history due to a system error');
  }
}

export class BetNotFoundError extends BetHistoryError {
  readonly code = 'BET_NOT_FOUND';
  constructor(gameId: string) {
    super(`Bet '${gameId}' not found`);
  }
}
