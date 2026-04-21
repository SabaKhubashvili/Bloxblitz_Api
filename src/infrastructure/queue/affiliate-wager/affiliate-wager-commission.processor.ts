import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ProcessAffiliateWagerCommissionUseCase } from '../../../application/user/affiliate/use-cases/process-affiliate-wager-commission.use-case';
import type { AffiliateWagerCommissionJobDto } from '../../../application/user/affiliate/dto/affiliate-wager-commission.job.dto';
import {
  AFFILIATE_WAGER_COMMISSION_JOB_NAME,
  AFFILIATE_WAGER_COMMISSION_QUEUE,
} from '../../../application/user/affiliate/affiliate-wager-commission.queue.constants';

@Injectable()
@Processor(AFFILIATE_WAGER_COMMISSION_QUEUE, { concurrency: 32 })
export class AffiliateWagerCommissionProcessor extends WorkerHost {
  private readonly logger = new Logger(AffiliateWagerCommissionProcessor.name);

  constructor(
    private readonly processCommission: ProcessAffiliateWagerCommissionUseCase,
  ) {
    super();
  }

  async process(job: Job<AffiliateWagerCommissionJobDto>): Promise<void> {
    if (job.name !== AFFILIATE_WAGER_COMMISSION_JOB_NAME) {
      throw new UnrecoverableError(
        `Unknown job name: ${String(job.name)} id=${job.id}`,
      );
    }

    const started = Date.now();
    const data = job.data;

    try {
      await this.processCommission.execute(data);
      this.logger.log(
        `[affiliate-wager] ok jobId=${job.id} bettor=${data.bettorUsername} ` +
          `referrer=${data.referrerUsername} commission=${data.commissionAmount} ` +
          `ms=${Date.now() - started}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('affiliate wager commission: referral row missing')) {
        this.logger.error(
          `[affiliate-wager] unrecoverable jobId=${job.id} payload=${JSON.stringify(data)}`,
          err instanceof Error ? err.stack : err,
        );
        throw new UnrecoverableError(msg);
      }
      this.logger.warn(
        `[affiliate-wager] transient failure jobId=${job.id} err=${msg}`,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    this.logger.error(
      `[affiliate-wager] worker failed jobId=${job?.id} name=${job?.name} err=${err.message}`,
      err.stack,
    );
  }
}
