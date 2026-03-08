import { createHash } from 'crypto';

/**
 * Hashes a Kinguin promo code using SHA-256.
 * Codes are stored as hashes in the database; never store or compare raw codes.
 * Use this for both: saving codes (import) and validating codes (redemption).
 */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
