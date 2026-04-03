import { DomainError } from '../../../shared/errors/domain.error';

export abstract class CaseError extends DomainError {}

export class CaseNotFoundError extends CaseError {
  readonly code = 'CASE_NOT_FOUND';
  constructor(slug: string) {
    super(`Case not found: ${slug}`);
  }
}

export class CaseInactiveError extends CaseError {
  readonly code = 'CASE_INACTIVE';
  constructor(slug: string) {
    super(`Case is not available: ${slug}`);
  }
}

export class CaseEmptyPoolError extends CaseError {
  readonly code = 'CASE_EMPTY_POOL';
  constructor() {
    super('Case has no valid reward items');
  }
}

export class CaseInsufficientBalanceError extends CaseError {
  readonly code = 'CASE_INSUFFICIENT_BALANCE';
  constructor() {
    super('Insufficient balance to open this case');
  }
}

export class CaseUserSeedNotFoundError extends CaseError {
  readonly code = 'CASE_USER_SEED_NOT_FOUND';
  constructor() {
    super('User seed not found — cannot open case');
  }
}

export class CaseInvalidQuantityError extends CaseError {
  readonly code = 'CASE_INVALID_QUANTITY';
  constructor() {
    super('Quantity must be between 1 and 5');
  }
}

export class CasePersistenceError extends CaseError {
  readonly code = 'CASE_PERSISTENCE_FAILED';
  constructor() {
    super('Failed to record case opening');
  }
}

export class CaseSlugTakenError extends CaseError {
  readonly code = 'CASE_SLUG_TAKEN';
  constructor(slug: string) {
    super(`Case slug already exists: ${slug}`);
  }
}

export class CaseUnknownPetsError extends CaseError {
  readonly code = 'CASE_UNKNOWN_PETS';
  constructor() {
    super('One or more pet IDs do not exist');
  }
}

export class CaseInvalidItemsError extends CaseError {
  readonly code = 'CASE_INVALID_ITEMS';
  constructor() {
    super('Case must have at least one item with positive weights');
  }
}

export class CaseCooldownError extends CaseError {
  readonly code = 'CASE_COOLDOWN';
  /** ISO-8601 timestamp when the cooldown expires. */
  readonly cooldownEndsAt: string;
  constructor(cooldownEndsAt: Date) {
    super(
      `Case opening is on cooldown. Available again at ${cooldownEndsAt.toISOString()}.`,
    );
    this.cooldownEndsAt = cooldownEndsAt.toISOString();
  }
}
