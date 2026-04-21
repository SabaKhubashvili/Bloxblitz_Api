import { Module } from '@nestjs/common';
import { AffiliateController } from '../../presentation/http/public/user/affiliate/affiliate.controller';
import { GetUsedReferralCodeUseCase } from '../../application/user/affiliate/use-cases/get-used-referral-code.use-case';
import { UseReferralCodeUseCase } from '../../application/user/affiliate/use-cases/use-referral-code.use-case';
import { CreateOwnReferralCodeUseCase } from '../../application/user/affiliate/use-cases/create-own-referral-code.use-case';
import { GetAffiliateStatsUseCase } from '../../application/user/affiliate/use-cases/get-affiliate-stats.use-case';
import { GetAffiliateSummaryUseCase } from '../../application/user/affiliate/use-cases/get-affiliate-summary.use-case';
import { ClaimReferralEarningsUseCase } from '../../application/user/affiliate/use-cases/claim-referral-earnings.use-case';
import { GetAffiliateReferralsUseCase } from '../../application/user/affiliate/use-cases/get-affiliate-referrals.use-case';
import { PrismaAffiliateRepository } from '../../infrastructure/persistance/repositories/user/affiliate.repository';
import { AFFILIATE_REPOSITORY } from '../../domain/referral/ports/affiliate.repository.port';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthModule } from '../auth.module';
import { AffiliateReadCacheAdapter } from '../../infrastructure/cache/adapters/affiliate-read-cache.adapter';
import { AFFILIATE_READ_CACHE_PORT } from '../../application/user/affiliate/ports/affiliate-read-cache.port';

@Module({
  imports: [AuthModule],
  controllers: [AffiliateController],
  providers: [
    JwtAuthGuard,
    GetUsedReferralCodeUseCase,
    UseReferralCodeUseCase,
    CreateOwnReferralCodeUseCase,
    GetAffiliateStatsUseCase,
    GetAffiliateSummaryUseCase,
    ClaimReferralEarningsUseCase,
    GetAffiliateReferralsUseCase,
    { provide: AFFILIATE_REPOSITORY, useClass: PrismaAffiliateRepository },
    {
      provide: AFFILIATE_READ_CACHE_PORT,
      useClass: AffiliateReadCacheAdapter,
    },
  ],
  exports: [
    AFFILIATE_REPOSITORY,
    AFFILIATE_READ_CACHE_PORT,
    GetUsedReferralCodeUseCase,
    UseReferralCodeUseCase,
    CreateOwnReferralCodeUseCase,
    GetAffiliateStatsUseCase,
    GetAffiliateSummaryUseCase,
    ClaimReferralEarningsUseCase,
    GetAffiliateReferralsUseCase,
  ],
})
export class AffiliateModule {}
