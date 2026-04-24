import { DomainError } from '../../shared/errors/domain.error';

export class UniwirePayoutNotFoundError extends DomainError {
  readonly code = 'UNIWIRE_PAYOUT_NOT_FOUND';
  constructor(payoutId?: string) {
    super(payoutId ? `Payout not found: ${payoutId}` : 'Payout not found');
  }
}

export class UniwirePayoutFailedError extends DomainError {
  readonly code = 'UNIWIRE_PAYOUT_FAILED';
  constructor(reason?: string) {
    super(reason ? `Payout failed: ${reason}` : 'Payout failed');
  }
}

export class UniwireTransactionNotFoundError extends DomainError {
  readonly code = 'UNIWIRE_TRANSACTION_NOT_FOUND';
  constructor(txid?: string) {
    super(txid ? `Transaction not found: ${txid}` : 'Transaction not found');
  }
}

export class UniwireTransactionNotConfirmedError extends DomainError {
  readonly code = 'UNIWIRE_TRANSACTION_NOT_CONFIRMED';
  constructor() {
    super('Transaction has not reached required confirmations');
  }
}

export class UniwireAddressNotFoundError extends DomainError {
  readonly code = 'UNIWIRE_ADDRESS_NOT_FOUND';
  constructor() {
    super('Coin address not found');
  }
}

export class UniwireProfileNotFoundError extends DomainError {
  readonly code = 'UNIWIRE_PROFILE_NOT_FOUND';
  constructor(username?: string) {
    super(
      username
        ? `No Uniwire profile linked for user: ${username}`
        : 'Uniwire profile not found',
    );
  }
}

export class UniwireApiError extends DomainError {
  readonly code = 'UNIWIRE_API_ERROR';
  constructor(reason: string) {
    super(`Uniwire API error: ${reason}`);
  }
}

export class UniwireExchangeRateUnavailableError extends DomainError {
  readonly code = 'UNIWIRE_EXCHANGE_RATE_UNAVAILABLE';
  constructor(symbol?: string) {
    super(
      symbol
        ? `Exchange rate unavailable for ${symbol}`
        : 'Exchange rate unavailable',
    );
  }
}
