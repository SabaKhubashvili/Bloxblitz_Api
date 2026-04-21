import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { IAffiliateRepository } from '../../../../domain/referral/ports/affiliate.repository.port';
import { AFFILIATE_REPOSITORY } from '../../../../domain/referral/ports/affiliate.repository.port';
import type { EnqueueAffiliateWagerCommissionDto } from '../dto/enqueue-affiliate-wager-commission.dto';
import type { AffiliateWagerCommissionJobDto } from '../dto/affiliate-wager-commission.job.dto';
import { computeAffiliateWagerCommissionAmount } from './affiliate-wager-commission.calculator';
import {
  AFFILIATE_WAGER_COMMISSION_JOB_NAME,
  AFFILIATE_WAGER_COMMISSION_QUEUE,
  affiliateWagerCommissionIdempotencyKey,
} from '../affiliate-wager-commission.queue.constants';

/**
 * Entry point for hot paths: resolves referrer by username, computes commission, enqueues durable work.
 * Heavy balance updates run in the BullMQ worker.
 */
@Injectable()
export class AffiliateWagerCommissionManager {
  private readonly logger = new Logger(AffiliateWagerCommissionManager.name);

  constructor(
    @InjectQueue(AFFILIATE_WAGER_COMMISSION_QUEUE)
    private readonly queue: Queue,
    @Inject(AFFILIATE_REPOSITORY)
    private readonly affiliates: IAffiliateRepository,
  ) {}

  /**
   * Fire-and-forget from callers via `void ...catch`; awaits only Redis enqueue + one indexed user read.
   */
  async enqueueWagerCommission(
    dto: EnqueueAffiliateWagerCommissionDto,
  ): Promise<void> {
    const snapshot = await this.affiliates.findReferrerSnapshotForBettor(
      dto.bettorUsername,
    );
    if (!snapshot) return;

    const bettorUsername = snapshot.bettorUsername;

    if (snapshot.referrerUsername === bettorUsername) {
      this.logger.warn(
        `[affiliate-wager] skip self-referral bettor=${bettorUsername}`,
      );
      return;
    }

    const commissionAmount = computeAffiliateWagerCommissionAmount(
      dto.wagerAmount,
    );
    if (commissionAmount <= 0) return;

    const job: AffiliateWagerCommissionJobDto = {
      bettorUsername,
      referrerUsername: snapshot.referrerUsername,
      referralCode: snapshot.referralCode,
      wagerAmount: dto.wagerAmount,
      commissionAmount,
      game: dto.game,
      sourceEventId: dto.sourceEventId,
    };

    const idempotencyKey = affiliateWagerCommissionIdempotencyKey(
      job.game,
      job.sourceEventId,
    );

    try {
      await this.queue.add(AFFILIATE_WAGER_COMMISSION_JOB_NAME, job, {
        jobId: idempotencyKey,
        attempts: 8,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: { age: 86_400, count: 50_000 },
        removeOnFail: false,
      });
    } catch (err) {
      this.logger.error(
        `[affiliate-wager] enqueue failed bettor=${dto.bettorUsername} game=${dto.game} sourceEventId=${dto.sourceEventId}`,
        err instanceof Error ? err.stack : err,
      );
      throw err;
    }
  }
}
