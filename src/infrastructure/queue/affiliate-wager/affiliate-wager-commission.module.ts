import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AffiliateModule } from '../../../modules/user/affiliate.module';
import { PrismaModule } from '../../persistance/prisma/prisma.module';
import { AffiliateWagerCommissionManager } from '../../../application/user/affiliate/services/affiliate-wager-commission.manager';
import { ProcessAffiliateWagerCommissionUseCase } from '../../../application/user/affiliate/use-cases/process-affiliate-wager-commission.use-case';
import { AFFILIATE_WAGER_COMMISSION_REPOSITORY } from '../../../domain/referral/ports/affiliate-wager-commission.repository.port';
import { PrismaAffiliateWagerCommissionRepository } from '../../persistance/repositories/user/affiliate-wager-commission.repository';
import { AffiliateWagerCommissionProcessor } from './affiliate-wager-commission.processor';
import { AFFILIATE_WAGER_COMMISSION_QUEUE } from '../../../application/user/affiliate/affiliate-wager-commission.queue.constants';

/**
 * Async affiliate wager commissions (BullMQ). Import wherever `InjectQueue(AFFILIATE_WAGER_COMMISSION_QUEUE)` is needed.
 */
@Global()
@Module({
  imports: [
    AffiliateModule,
    PrismaModule,
    BullModule.registerQueue({
      name: AFFILIATE_WAGER_COMMISSION_QUEUE,
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    AffiliateWagerCommissionManager,
    ProcessAffiliateWagerCommissionUseCase,
    AffiliateWagerCommissionProcessor,
    {
      provide: AFFILIATE_WAGER_COMMISSION_REPOSITORY,
      useClass: PrismaAffiliateWagerCommissionRepository,
    },
  ],
  exports: [
    BullModule,
    AffiliateWagerCommissionManager,
    ProcessAffiliateWagerCommissionUseCase,
  ],
})
export class AffiliateWagerCommissionModule {}
