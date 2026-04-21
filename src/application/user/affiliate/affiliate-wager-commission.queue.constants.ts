import type { AffiliateWagerCommissionJobDto } from './dto/affiliate-wager-commission.job.dto';

export const AFFILIATE_WAGER_COMMISSION_QUEUE =
  'affiliate-wager-commission' as const;

export const AFFILIATE_WAGER_COMMISSION_JOB_NAME =
  'apply-wager-commission' as const;

/**
 * BullMQ custom `jobId` must not contain `:` (Redis key separator); see
 * https://docs.bullmq.io/guide/jobs/job-ids — WS games used `sourceEventId`
 * values like `coinflipGameId:p1` which broke enqueue.
 */
export function affiliateWagerCommissionIdempotencyKey(
  game: AffiliateWagerCommissionJobDto['game'],
  sourceEventId: string,
): string {
  const safeSource = sourceEventId.replace(/:/g, '_');
  return `${game}-${safeSource}`;
}
