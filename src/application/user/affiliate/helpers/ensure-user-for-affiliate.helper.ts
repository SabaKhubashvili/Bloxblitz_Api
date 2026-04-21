import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { UserNotFoundError } from '../../../../domain/user/errors/user.errors';
import type { IAffiliateRepository } from '../../../../domain/referral/ports/affiliate.repository.port';

export async function ensureUserExistsForAffiliate(
  repo: IAffiliateRepository,
  username: string,
): Promise<Result<void, UserNotFoundError>> {
  const row = await repo.getUsedReferralCode(username);
  if (!row) return Err(new UserNotFoundError(username));
  return Ok(undefined);
}
