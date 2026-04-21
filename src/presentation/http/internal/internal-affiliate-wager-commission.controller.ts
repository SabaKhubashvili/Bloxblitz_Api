import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AffiliateWagerCommissionManager } from '../../../application/user/affiliate/services/affiliate-wager-commission.manager';
import { InternalMicroserviceSecretGuard } from './guards/internal-microservice-secret.guard';
import { PostInternalAffiliateWagerCommissionBodyDto } from './dto/post-internal-affiliate-wager-commission.body.dto';

/**
 * Machine-to-machine only (WS → API). Secured via {@link InternalMicroserviceSecretGuard}.
 */
@Controller('internal/affiliate')
@UseGuards(InternalMicroserviceSecretGuard)
export class InternalAffiliateWagerCommissionController {
  constructor(
    private readonly affiliateWagerCommission: AffiliateWagerCommissionManager,
  ) {}

  @Post('wager-commission')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(
    @Body() body: PostInternalAffiliateWagerCommissionBodyDto,
  ): Promise<{ ok: true }> {
    await this.affiliateWagerCommission.enqueueWagerCommission({
      bettorUsername: body.bettorUsername.trim(),
      wagerAmount: body.wagerAmount,
      sourceEventId: body.sourceEventId,
      game: body.game,
    });
    return { ok: true };
  }
}
