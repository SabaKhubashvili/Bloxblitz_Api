import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { ReferralInvalidCodeFormatError } from '../../../../domain/referral/errors/referral.errors';

/** Allowed characters after trim + lowercase; length 3–32 inclusive. */
const CODE_PATTERN = /^[a-z0-9_-]{3,32}$/;

/**
 * Trims, lowercases, and validates referral codes. All persisted and lookup
 * values should go through this so matching is case-insensitive.
 */
export function normalizeReferralCode(
  raw: string,
): Result<string, ReferralInvalidCodeFormatError> {
  const normalized = raw.trim().toLowerCase();
  if (!CODE_PATTERN.test(normalized)) {
    return Err(new ReferralInvalidCodeFormatError());
  }
  return Ok(normalized.toLowerCase());
}
