import { DomainError } from '../../shared/errors/domain.error';

// ─── Base ─────────────────────────────────────────────────────────────────────

export abstract class TransactionDomainError extends DomainError {}

// ─── Read errors ──────────────────────────────────────────────────────────────

/**
 * Thrown when the repository layer fails to retrieve transaction records
 * due to an unexpected infrastructure error (DB unreachable, query timeout, etc.).
 */
export class TransactionFetchError extends TransactionDomainError {
  readonly code = 'TRANSACTION_FETCH_FAILED';

  constructor() {
    super('Failed to retrieve transaction history due to a system error');
  }
}

/**
 * Thrown when a specific transaction ID is requested but does not exist,
 * or exists but belongs to a different user (ownership check failed).
 */
export class TransactionNotFoundError extends TransactionDomainError {
  readonly code = 'TRANSACTION_NOT_FOUND';

  constructor(id: string) {
    super(`Transaction '${id}' not found`);
  }
}

/**
 * Thrown when a date-range filter is provided with `from` > `to`.
 * Validated in the use-case before hitting the repository.
 */
export class InvalidDateRangeError extends TransactionDomainError {
  readonly code = 'TRANSACTION_INVALID_DATE_RANGE';

  constructor() {
    super("'from' date must not be after 'to' date");
  }
}

// ─── Write errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when persisting a new transaction record fails at the infrastructure
 * level (constraint violation, connection error, etc.).
 */
export class TransactionCreateError extends TransactionDomainError {
  readonly code = 'TRANSACTION_CREATE_FAILED';

  constructor() {
    super('Failed to record the transaction due to a system error');
  }
}

/**
 * Thrown when a `create` command arrives with a non-positive coin amount.
 * Caught at the use-case boundary before any DB write occurs.
 */
export class InvalidTransactionAmountError extends TransactionDomainError {
  readonly code = 'TRANSACTION_INVALID_AMOUNT';

  constructor(amount: number) {
    super(`Transaction coin amount must be positive, got ${amount}`);
  }
}

// ─── Union type ───────────────────────────────────────────────────────────────

export type TransactionError =
  | TransactionFetchError
  | TransactionNotFoundError
  | InvalidDateRangeError
  | TransactionCreateError
  | InvalidTransactionAmountError;
