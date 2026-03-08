import { DomainError } from '../../shared/errors/domain.error';

export abstract class UserError extends DomainError {}

export class UserNotFoundError extends UserError {
  readonly code = 'USER_NOT_FOUND';

  constructor(username: string) {
    super(`User '${username}' not found`);
  }
}

export class BalanceFetchError extends UserError {
  readonly code = 'USER_BALANCE_FETCH_FAILED';

  constructor() {
    super('Failed to retrieve user balance due to a system error');
  }
}
