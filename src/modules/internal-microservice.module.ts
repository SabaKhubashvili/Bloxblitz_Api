import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalAffiliateWagerCommissionController } from '../presentation/http/internal/internal-affiliate-wager-commission.controller';
import { InternalMicroserviceSecretGuard } from '../presentation/http/internal/guards/internal-microservice-secret.guard';

/**
 * Internal HTTP surface for sibling services (e.g. WS). Requires {@link AffiliateWagerCommissionModule} (global).
 */
@Module({
  imports: [ConfigModule],
  controllers: [InternalAffiliateWagerCommissionController],
  providers: [InternalMicroserviceSecretGuard],
})
export class InternalMicroserviceModule {}
