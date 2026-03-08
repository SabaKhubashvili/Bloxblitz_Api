import { DomainError } from '../../shared/errors/domain.error';

export class KinguinCodeNotFoundError extends DomainError {
  readonly code = 'KINGUIN_CODE_NOT_FOUND';
  constructor() {
    super('Code not found or already redeemed');
  }
}

export class KinguinCodeAlreadyRedeemedError extends DomainError {
  readonly code = 'KINGUIN_CODE_ALREADY_REDEEMED';
  constructor() {
    super('Code not found or already redeemed');
  }
}

export class KinguinCodeExpiredError extends DomainError {
  readonly code = 'KINGUIN_CODE_EXPIRED';
  constructor() {
    super('This promo code has expired');
  }
}

export class KinguinCodeDisabledError extends DomainError {
  readonly code = 'KINGUIN_CODE_DISABLED';
  constructor() {
    super('This promo code has been disabled');
  }
}

export class KinguinCodeRedemptionInProgressError extends DomainError {
  readonly code = 'KINGUIN_CODE_REDEMPTION_IN_PROGRESS';
  constructor() {
    super('A redemption for this code is already in progress');
  }
}

export class KinguinBatchNotFoundError extends DomainError {
  readonly code = 'KINGUIN_BATCH_NOT_FOUND';
  constructor() {
    super('Batch not found');
  }
}

export class KinguinBatchImportError extends DomainError {
  readonly code = 'KINGUIN_BATCH_IMPORT_ERROR';
  constructor(reason: string) {
    super(`Batch import failed: ${reason}`);
  }
}
