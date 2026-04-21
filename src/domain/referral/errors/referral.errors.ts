import { DomainError } from '../../shared/errors/domain.error';

export type ReferralError =
  | ReferralCodeNotFoundError
  | ReferralUseCooldownError
  | ReferralSelfReferralError
  | ReferralAlreadyCreatedError
  | ReferralCodeTakenError
  | ReferralNothingToClaimError
  | ReferralBelowMinimumClaimError
  | ReferralInvalidCodeFormatError;

export class ReferralCodeNotFoundError extends DomainError {
  readonly code = 'REFERRAL_CODE_NOT_FOUND';
  constructor() {
    super('No affiliate exists with this code');
  }
}

export class ReferralUseCooldownError extends DomainError {
  readonly code = 'REFERRAL_USE_COOLDOWN';
  constructor(nextAllowedAt: Date) {
    super(
      `You can change your referral code again after ${nextAllowedAt.toISOString()}`,
    );
  }
}

export class ReferralSelfReferralError extends DomainError {
  readonly code = 'REFERRAL_SELF_REFERRAL';
  constructor() {
    super('You cannot use your own affiliate code');
  }
}

export class ReferralAlreadyCreatedError extends DomainError {
  readonly code = 'REFERRAL_ALREADY_CREATED';
  constructor() {
    super('You have already created an affiliate code');
  }
}

export class ReferralCodeTakenError extends DomainError {
  readonly code = 'REFERRAL_CODE_TAKEN';
  constructor() {
    super('This affiliate code is already taken');
  }
}

export class ReferralNothingToClaimError extends DomainError {
  readonly code = 'REFERRAL_NOTHING_TO_CLAIM';
  constructor() {
    super('No referral balance to claim');
  }
}

export class ReferralBelowMinimumClaimError extends DomainError {
  readonly code = 'REFERRAL_BELOW_MINIMUM_CLAIM';
  constructor(minimum: number) {
    super(`Minimum claim amount is ${minimum.toFixed(2)}`);
  }
}

export class ReferralInvalidCodeFormatError extends DomainError {
  readonly code = 'REFERRAL_INVALID_CODE_FORMAT';
  constructor() {
    super(
      'Code must be 3–32 characters and contain only letters, numbers, underscores, or hyphens',
    );
  }
}
